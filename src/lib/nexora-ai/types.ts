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
  | "ACTIVITY"
  | "HELP"
  | "CANCEL"
  | "CONFIRM"
  | "UNKNOWN";

export interface ParsedCommand {
  raw: string;
  normalized: string;
  intent: AssistantIntent;
  action?: "ON" | "OFF" | "OPEN" | "CLOSE" | "STOP" | "ARM" | "DISARM" | "SET_BRIGHTNESS" | "SET_COLOR";
  /** Brightness percentage for SET_BRIGHTNESS. */
  value?: number;
  /** Named colour for SET_COLOR. */
  color?: NamedColor;
  /** Requested siren duration, when the user names one ("for 5 seconds"). */
  durationSeconds?: number;
  activity?: ActivityQuestion;
  deviceType?: Device["type"];
  targetText?: string;
  group?: "ALL" | "HOUSE" | "ESTATE";
  helpTopic?: "GENERAL" | "SECURITY" | "GATE" | "DEVICES" | "EXAMPLES";
  unsupportedFeature?: "TEMPERATURE" | "FAN_SPEED";
}

export interface NamedColor { name: string; r: number; g: number; b: number }

export type ActivityQuestion =
  | { kind: "OFFLINE_DEVICES" }
  | { kind: "LAST_MOTION" }
  | { kind: "ALARMS"; hours: number }
  | { kind: "SUMMARY"; hours: number }
  | { kind: "DEVICE_HISTORY" }
  | { kind: "CONTROLLER_STATUS" };

export interface CommandParameters { value?: number; r?: number; g?: number; b?: number; durationSeconds?: number }

export interface ResolvedCommand {
  intent: "CONTROL_DEVICE";
  deviceIds: DeviceId[];
  devices: Device[];
  command: DeviceCommandType;
  parameters?: CommandParameters;
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
  scope: "HOUSE" | "HOUSES" | "ESTATE_PERIMETER";
  houseIds?: HouseId[];
  estateId?: string;
  mode: "DISARMED" | "ARMED_HOME" | "ARMED_AWAY";
  createdAt: number;
  expiresAt: number;
}

export interface PendingSecurityTarget {
  action: "ARM" | "DISARM";
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
  pendingSecurityTarget: PendingSecurityTarget | null;
  pendingClarification: PendingClarification | null;
  /** A routine waiting for the user to confirm its whole plan. */
  pendingRoutine?: PendingRoutine | null;
  /** Remaining steps of a multi-step request, resumed once a confirmation or choice is answered. */
  queuedSteps?: string[];
  queuedPreConfirmed?: boolean;
}

export interface PendingRoutine {
  name: string;
  steps: string[];
  createdAt: number;
  expiresAt: number;
}
