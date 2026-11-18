import type { Device, DeviceCommand, DeviceState, Room } from "../../domain/smart-estate.ts";
import { supportsCommand } from "../device-capabilities.ts";

export const ALEXA_PAYLOAD_VERSION = "3";
export const ALEXA_EXPOSED_TYPES = new Set<Device["type"]>(["LIGHT", "FAN"]);

export type AlexaDirective = {
  directive?: {
    header?: { namespace?: string; name?: string; payloadVersion?: string; messageId?: string; correlationToken?: string };
    endpoint?: { endpointId?: string; scope?: { type?: string; token?: string } };
    payload?: Record<string, unknown>;
  };
};

export type AlexaAuthorizedInventory = { devices: Device[]; rooms: Room[]; states: Record<string, DeviceState> };
export type AlexaControlContext = {
  discover(token: string): Promise<AlexaAuthorizedInventory>;
  command(token: string, deviceId: string, command: "TURN_ON" | "TURN_OFF", requestId: string): Promise<DeviceCommand>;
  isReplay(messageId: string): Promise<boolean>;
  endpointIdFor?(deviceId: string): string;
  deviceIdFromEndpoint?(endpointId: string): string | null;
};

const endpointId = (deviceId: string) => `nexora-device-${deviceId}`;
const deviceIdFromEndpoint = (value: string) => value.startsWith("nexora-device-") ? value.slice("nexora-device-".length) : null;
const header = (name: string, messageId = crypto.randomUUID(), correlationToken?: string) => ({ namespace: "Alexa", name, payloadVersion: ALEXA_PAYLOAD_VERSION, messageId, ...(correlationToken ? { correlationToken } : {}) });

function errorResponse(type: string, message: string, correlationToken?: string) {
  return { event: { header: header("ErrorResponse", crypto.randomUUID(), correlationToken), payload: { type, message } } };
}

function bearerToken(input: AlexaDirective) {
  const scope = input.directive?.endpoint?.scope ?? (input.directive?.payload?.scope as { type?: string; token?: string } | undefined);
  return scope?.type === "BearerToken" && typeof scope.token === "string" && scope.token.length > 0 ? scope.token : null;
}

export function alexaDiscoverable(device: Device) {
  return ALEXA_EXPOSED_TYPES.has(device.type) && supportsCommand(device, "TURN_ON") && supportsCommand(device, "TURN_OFF") && (!device.allowedOperations || device.allowedOperations.includes("COMMAND"));
}

export function discoveryEndpoints(inventory: AlexaAuthorizedInventory, encodeEndpoint: (deviceId: string) => string = endpointId) {
  return inventory.devices.filter(alexaDiscoverable).map((device) => {
    const room = inventory.rooms.find(item => item.id === device.roomId);
    return {
      endpointId: encodeEndpoint(device.id),
      manufacturerName: "Nexora Smart Estate",
      description: `${device.type === "FAN" ? "Fan" : "Light"}${room ? ` in ${room.name}` : ""}`,
      friendlyName: device.name,
      displayCategories: [device.type === "FAN" ? "FAN" : "LIGHT"],
      cookie: {},
      capabilities: [
        { type: "AlexaInterface", interface: "Alexa", version: ALEXA_PAYLOAD_VERSION },
        { type: "AlexaInterface", interface: "Alexa.PowerController", version: ALEXA_PAYLOAD_VERSION, properties: { supported: [{ name: "powerState" }], proactivelyReported: false, retrievable: true } },
        { type: "AlexaInterface", interface: "Alexa.EndpointHealth", version: ALEXA_PAYLOAD_VERSION, properties: { supported: [{ name: "connectivity" }], proactivelyReported: false, retrievable: true } },
      ],
    };
  });
}

export async function handleAlexaDirective(input: AlexaDirective, control: AlexaControlContext) {
  const directive = input.directive;
  const correlation = directive?.header?.correlationToken;
  if (!directive?.header?.messageId || directive.header.payloadVersion !== ALEXA_PAYLOAD_VERSION) return errorResponse("INVALID_DIRECTIVE", "A valid Alexa v3 directive is required.", correlation);
  const token = bearerToken(input);
  if (!token) return errorResponse("INVALID_AUTHORIZATION_CREDENTIAL", "Account linking credentials are missing or invalid.", correlation);
  let inventory: AlexaAuthorizedInventory;
  try { inventory = await control.discover(token); }
  catch { return errorResponse("INVALID_AUTHORIZATION_CREDENTIAL", "The linked Nexora account could not be authorized.", correlation); }
  if (await control.isReplay(directive.header.messageId)) return errorResponse("INVALID_DIRECTIVE", "This directive was already processed.", correlation);

  if (directive.header.namespace === "Alexa.Discovery" && directive.header.name === "Discover") {
    return { event: { header: { namespace: "Alexa.Discovery", name: "Discover.Response", payloadVersion: ALEXA_PAYLOAD_VERSION, messageId: crypto.randomUUID() }, payload: { endpoints: discoveryEndpoints(inventory, control.endpointIdFor) } } };
  }

  const decodeEndpoint = control.deviceIdFromEndpoint ?? deviceIdFromEndpoint;
  const encodeEndpoint = control.endpointIdFor ?? endpointId;
  const deviceId = directive.endpoint?.endpointId ? decodeEndpoint(directive.endpoint.endpointId) : null;
  const device = deviceId ? inventory.devices.find(item => item.id === deviceId && alexaDiscoverable(item)) : null;
  if (!device) return errorResponse("NO_SUCH_ENDPOINT", "The requested device is not available to this account.", correlation);
  const state = inventory.states[device.id];
  if (!state || state.connectivity !== "ONLINE") return errorResponse("ENDPOINT_UNREACHABLE", "The device controller is offline or has no current state.", correlation);
  if (directive.header.namespace === "Alexa" && directive.header.name === "ReportState") {
    const on = typeof state.reported?.on === "boolean" ? state.reported.on : null;
    if (on === null) return errorResponse("ENDPOINT_UNREACHABLE", "The device has not reported an authoritative power state.", correlation);
    return { event: { header: header("StateReport", crypto.randomUUID(), correlation), endpoint: { scope: { type: "BearerToken", token }, endpointId: encodeEndpoint(device.id) }, payload: {} }, context: { properties: [
      { namespace: "Alexa.PowerController", name: "powerState", value: on ? "ON" : "OFF", timeOfSample: state.lastReportedAt, uncertaintyInMilliseconds: 500 },
      { namespace: "Alexa.EndpointHealth", name: "connectivity", value: { value: "OK" }, timeOfSample: state.lastReportedAt, uncertaintyInMilliseconds: 500 },
    ] } };
  }
  if (directive.header.namespace !== "Alexa.PowerController" || !["TurnOn", "TurnOff"].includes(directive.header.name ?? "")) return errorResponse("INVALID_DIRECTIVE", "This operation is not supported for the device.", correlation);
  try {
    const commandType = directive.header.name === "TurnOn" ? "TURN_ON" : "TURN_OFF";
    const command = await control.command(token, device.id, commandType, directive.header.messageId);
    if (command.status === "FAILED" || command.status === "TIMEOUT") return errorResponse("ENDPOINT_UNREACHABLE", command.error ?? "The device did not acknowledge the command.", correlation);
    if (command.status !== "EXECUTED") return errorResponse("ENDPOINT_BUSY", "The command is awaiting controller acknowledgement.", correlation);
    return { event: { header: header("Response", crypto.randomUUID(), correlation), endpoint: { scope: { type: "BearerToken", token }, endpointId: encodeEndpoint(device.id) }, payload: {} }, context: { properties: [{ namespace: "Alexa.PowerController", name: "powerState", value: commandType === "TURN_ON" ? "ON" : "OFF", timeOfSample: command.completedAt ?? new Date().toISOString(), uncertaintyInMilliseconds: 500 }] } };
  } catch { return errorResponse("ENDPOINT_UNREACHABLE", "The Nexora control service rejected the command.", correlation); }
}
