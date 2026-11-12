import type { Device, DeviceCommandType, DeviceId, HouseId } from "../../domain/smart-estate.ts";

export type AssistantPhase = "idle" | "listening" | "processing" | "executing" | "speaking" | "success" | "error";
export type AssistantMessageKind = "user" | "assistant" | "status";

export interface AssistantMessage {
  id: string;
  kind: AssistantMessageKind;
  text: string;
  phase?: AssistantPhase;
  createdAt: string;
}

export type AssistantIntent =
  | "CONTROL_DEVICE"
  | "DEVICE_STATUS"
  | "LIST_DEVICES"
  | "SECURITY_STATUS"
  | "SECURITY_CONTROL"
  | "CAPABILITIES"
  | "ESTATE_OVERVIEW"
  | "UNSUPPORTED_FEATURE"
  | "HELP"
  | "CANCEL"
  | "CONFIRM"
  | "UNKNOWN";

export interface ParsedCommand {
  raw: string;
  normalized: string;
  intent: AssistantIntent;
  action?: "ON" | "OFF" | "OPEN" | "CLOSE" | "STOP" | "ARM" | "DISARM";
  deviceType?: Device["type"];
  targetText?: string;
  group?: "ALL" | "HOUSE" | "ESTATE";
  helpTopic?: "GENERAL" | "SECURITY" | "GATE" | "DEVICES" | "EXAMPLES";
  unsupportedFeature?: "TEMPERATURE" | "FAN_SPEED";
}

export interface ResolvedCommand {
  intent: "CONTROL_DEVICE";
  deviceIds: DeviceId[];
  devices: Device[];
  command: DeviceCommandType;
  houseId?: HouseId;
  grouped?: boolean;
}

export interface PendingConfirmation {
  id: string;
  command: ResolvedCommand;
  createdAt: number;
  expiresAt: number;
}

export interface PendingSecurityConfirmation {
  houseId: HouseId;
  mode: "DISARMED" | "ARMED_HOME" | "ARMED_AWAY";
  createdAt: number;
  expiresAt: number;
}

export interface PendingClarification {
  parsed: ParsedCommand;
  candidateIds: DeviceId[];
  createdAt: number;
  expiresAt: number;
}

export interface ConversationContext {
  userKey: string;
  houseId: HouseId | null;
  lastDeviceIds: DeviceId[];
  lastHouseId: HouseId | null;
  pendingConfirmation: PendingConfirmation | null;
  pendingSecurityConfirmation: PendingSecurityConfirmation | null;
  pendingClarification: PendingClarification | null;
}
