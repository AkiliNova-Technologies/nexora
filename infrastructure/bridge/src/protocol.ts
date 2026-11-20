import type { BridgeSync, CloudEvent } from "./types.js";

const topicPattern = /^smartestate\/v1\/([^/]+)\/([^/]+)\/(ack|state|status|event)$/;
const heartbeatPattern = /^smartestate\/v1\/controllers\/([^/]+)\/heartbeat$/;
const provisioningAckPattern = /^smartestate\/v1\/controllers\/([^/]+)\/provisioning\/ack$/;
const idPattern = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;

export type ParsedMessage =
  | { type: "device"; controllerId: string; event: CloudEvent }
  | { type: "heartbeat"; controllerId: string; body: Record<string, unknown> }
  | { type: "provisioningAck"; controllerId:string; body:Record<string,unknown> };

function objectPayload(payload: Buffer, maxBytes: number): Record<string, unknown> {
  if (payload.byteLength > maxBytes) throw new Error("payload_too_large");
  const value: unknown = JSON.parse(payload.toString("utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("invalid_payload");
  return value as Record<string, unknown>;
}

export function parseInbound(topic: string, payload: Buffer, sync: BridgeSync, maxBytes: number): ParsedMessage {
  const body = objectPayload(payload, maxBytes);
  const provisioningAck=provisioningAckPattern.exec(topic);
  if(provisioningAck){const controllerId=provisioningAck[1]!;if(!idPattern.test(controllerId)||!sync.controllers.some(item=>item.controllerId===controllerId)||sync.revokedControllerIds.includes(controllerId))throw new Error("unregistered_controller");if(typeof body.commandId!=="string"||!idPattern.test(body.commandId)||!["ACCEPTED","EXECUTED","FAILED"].includes(String(body.status)))throw new Error("invalid_provisioning_ack");return {type:"provisioningAck",controllerId,body};}
  const heartbeat = heartbeatPattern.exec(topic);
  if (heartbeat) {
    const controllerId = heartbeat[1]!;
    if (!idPattern.test(controllerId) || body.controllerId !== controllerId) throw new Error("invalid_controller_identity");
    if (!sync.controllers.some((item) => item.controllerId === controllerId)) throw new Error("unregistered_controller");
    return { type: "heartbeat", controllerId, body };
  }
  const match = topicPattern.exec(topic);
  if (!match) throw new Error("invalid_topic");
  const scopeId = match[1]!;
  const deviceId = match[2]!;
  const kind = match[3]! as CloudEvent["kind"];
  const registration = sync.controllers.find((item) => item.devices.some((device) => device.deviceId === deviceId && device.scopeId === scopeId));
  if (!registration || sync.revokedControllerIds.includes(registration.controllerId)) throw new Error("unauthorized_device_topic");
  const eventId = body.eventId;
  if (typeof eventId !== "string" || !idPattern.test(eventId)) throw new Error("invalid_event_id");
  return {
    type: "device",
    controllerId: registration.controllerId,
    event: { eventId, scopeId, deviceId, kind, receivedAt: new Date().toISOString(), body },
  };
}

export function commandTopic(command: { scopeId: string; deviceId: string }) {
  if (!idPattern.test(command.scopeId) || !idPattern.test(command.deviceId)) throw new Error("invalid_command_identity");
  return `smartestate/v1/${command.scopeId}/${command.deviceId}/command`;
}
