import type { Device, DeviceCommandType, DeviceState, Room } from "../../domain/smart-estate.ts";
import { supportsCommand } from "../device-capabilities.ts";
import type { ConversationContext, ParsedCommand, PendingConfirmation, ResolvedCommand } from "./types.ts";

export const CONTEXT_TTL_MS = 5 * 60_000;
export const CONFIRMATION_TTL_MS = 30_000;
export const TRANSCRIPT_DEDUP_MS = 5_000;

export function normalizeCommand(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s'-]/g, " ").replace(/\s+/g, " ").trim();
}

export function shouldProcessTranscript(recent: Map<string, number>, transcript: string, now = Date.now()) {
  const normalized = normalizeCommand(transcript);
  if (!normalized) return false;
  for (const [key, timestamp] of recent) {
    if (now - timestamp > TRANSCRIPT_DEDUP_MS) recent.delete(key);
  }
  const previous = recent.get(normalized);
  if (previous !== undefined && now - previous <= TRANSCRIPT_DEDUP_MS) return false;
  recent.set(normalized, now);
  return true;
}

export function permissionContextKey(devices: Device[]) {
  return devices.map((device) => `${device.id}:${(device.allowedOperations ?? []).toSorted().join(",")}`).toSorted().join("|");
}

export function parseCommand(raw: string): ParsedCommand {
  const normalized = normalizeCommand(raw);
  if (!normalized) return { raw, normalized, intent: "UNKNOWN" };
  if (/^(yes|yes please|confirm|confirm it|do it|proceed|go ahead|okay|ok|sure)$/.test(normalized)) return { raw, normalized, intent: "CONFIRM" };
  if (/^(no|no thanks|cancel|cancel it|never mind|nevermind|not now|dont|do not)$/.test(normalized)) return { raw, normalized, intent: "CANCEL" };
  if (/\b(set|change|make)\b.*\b(temperature|degrees?|celsius)\b|\b(temperature|thermostat)\b.*\b\d+\b/.test(normalized)) return { raw, normalized, intent: "UNSUPPORTED_FEATURE", unsupportedFeature: "TEMPERATURE" };
  if (/\b(set|change)\b.*\b(fan speed|speed)\b/.test(normalized)) return { raw, normalized, intent: "UNSUPPORTED_FEATURE", unsupportedFeature: "FAN_SPEED" };
  if (/\b(tell|describe)\b.*\b(estate|property)\b|\bwhat(?:'s| is) (?:in|available in) (?:this|the) estate\b/.test(normalized)) return { raw, normalized, intent: "ESTATE_OVERVIEW" };
  if (/\b(what can you do|what are your capabilities|what commands|what can i ask|how do i use nexora|how can you help|give me examples|show commands|help me)\b|^help$/.test(normalized)) {
    const helpTopic = /example|commands/.test(normalized) ? "EXAMPLES" : /security/.test(normalized) ? "SECURITY" : "GENERAL";
    return { raw, normalized, intent: "CAPABILITIES", helpTopic };
  }
  if (/\bcan you\b.*\b(gate)\b/.test(normalized)) return { raw, normalized, intent: "CAPABILITIES", helpTopic: "GATE" };
  if (/\bcan you\b.*\b(security|arm|disarm)\b|\bwhat can you do with security\b/.test(normalized)) return { raw, normalized, intent: "CAPABILITIES", helpTopic: "SECURITY" };
  if (/\b(arm|disarm)\b/.test(normalized)) return { raw, normalized, intent: "SECURITY_CONTROL", action: /\bdisarm\b/.test(normalized) ? "DISARM" : "ARM", targetText: extractTarget(normalized), group: /\b(entire|whole|all|both)\b/.test(normalized) ? "ESTATE" : "HOUSE" };
  if (/(list|show|what).*(devices|controllers)|available devices|connected devices/.test(normalized)) {
    return { raw, normalized, intent: "LIST_DEVICES", targetText: extractTarget(normalized) };
  }
  if (/(security status|motion status)|\b(check|show|what|report|has|which)\b.*\b(security|secure|armed|motion|alerts?|sensors?)\b/.test(normalized)) {
    return { raw, normalized, intent: "SECURITY_STATUS", deviceType: "MOTION_SENSOR" };
  }

  const deviceType = detectDeviceType(normalized);
  const status = /^(is|are|what|check|status|show|tell)|\b(status|state)\b/.test(normalized);
  if (deviceType && status) return { raw, normalized, intent: "DEVICE_STATUS", deviceType, targetText: extractTarget(normalized) };

  const action = /\b(turn|switch)(?:\s+(?:it|them|that|those|everything))?\s+on\b|\blights? on\b|\bfans? on\b/.test(normalized) ? "ON"
    : /\b(turn|switch)(?:\s+(?:it|them|that|those))?\s+off\b|\blights? off\b|\bfans? off\b/.test(normalized) ? "OFF"
    : /\bopen\b/.test(normalized) ? "OPEN"
    : /\bclose\b/.test(normalized) ? "CLOSE"
    : /\bstop\b/.test(normalized) ? "STOP"
    : undefined;
  if (action && (deviceType || /\b(it|them|that|those)\b/.test(normalized))) {
    const group = /\b(all|every|both|everything|interior)\b/.test(normalized) ? (/\b(estate|both houses|all houses)\b/.test(normalized) ? "ESTATE" : "ALL") : undefined;
    return { raw, normalized, intent: "CONTROL_DEVICE", action, deviceType, targetText: extractTarget(normalized), group };
  }
  return { raw, normalized, intent: "UNKNOWN" };
}

function detectDeviceType(value: string): Device["type"] | undefined {
  if (/\b(gate|entrance)\b/.test(value)) return "GATE";
  if (/\b(light|lights|lighting|lamp|lamps|perimeter|fence lights|wall lights|outdoor lighting|compound lights)\b/.test(value)) return "LIGHT";
  if (/\b(fan|fans|ac|air conditioner|ventilation)\b/.test(value)) return "FAN";
  if (/\b(motion|motion sensor|motion sensors)\b/.test(value)) return "MOTION_SENSOR";
  if (/\b(sensor|sensors|security)\b/.test(value)) return "CONTACT_SENSOR";
  return undefined;
}

function extractTarget(value: string) {
  return value
    .replace(/\b(turn|switch|open|close|stop|arm|disarm|check|show|list|tell|what|is|are|me|my|all|every|both|interior|available|connected|the|on|off|status|state|devices?|controllers?|in|at|for|please|could|would|you)\b/g, " ")
    .replace(/\b(light|lights|lighting|lamp|lamps|fan|fans|ac|air conditioner|ventilation|gate|motion|sensor|sensors|security|house|estate)\b/g, " ")
    .replace(/\s+/g, " ").trim() || undefined;
}

/** Resolve a short natural-language answer against the exact candidate list we offered. */
export function resolveClarificationChoice(
  reply: string,
  candidates: Device[],
  rooms: Room[],
  houses: Array<{ id: string; name: string }> = [],
): Device | null {
  if (!candidates.length) return null;
  const normalized = normalizeCommand(reply);
  if (!normalized) return null;

  const namedNumber = normalized.match(/\b(?:light|lamp|fan|device|option|number)\s*(1|2|3)\b/);
  if (namedNumber) {
    const numbered = candidates.filter((device) => new RegExp("\\b(?:light|lamp|fan|device)\\s*" + namedNumber[1] + "\\b").test(normalizeCommand(device.name)));
    if (numbered.length === 1) return numbered[0];
  }
  const ordinal = normalized.match(/\b(first|second|third|1st|2nd|3rd|one|two|three|1|2|3)\b/);
  if (ordinal) {
    const index = ({ first: 0, "1st": 0, one: 0, "1": 0, second: 1, "2nd": 1, two: 1, "2": 1, third: 2, "3rd": 2, three: 2, "3": 2 } as Record<string, number>)[ordinal[1]];
    if (index !== undefined && candidates[index]) return candidates[index];
  }

  const exact = candidates.filter((device) => {
    const room = rooms.find((item) => item.id === device.roomId);
    const house = houses.find((item) => item.id === device.houseId);
    const labels = [device.name, room?.name, house?.name].filter(Boolean).map((value) => normalizeCommand(value!));
    return labels.some((label) => label === normalized || label.includes(normalized));
  });
  if (exact.length === 1) return exact[0];

  const words = normalized.split(" ").filter((word) => word.length > 1 && !["the", "one", "please", "number", "option"].includes(word));
  const matches = candidates.filter((device) => {
    const room = rooms.find((item) => item.id === device.roomId);
    const house = houses.find((item) => item.id === device.houseId);
    const label = normalizeCommand(`${device.name} ${room?.name ?? ""} ${house?.name ?? ""}`);
    return words.length > 0 && words.every((word) => label.split(" ").includes(word));
  });
  return matches.length === 1 ? matches[0] : null;
}

export type Resolution =
  | { kind: "resolved"; command: ResolvedCommand }
  | { kind: "ambiguous"; candidates: Device[] }
  | { kind: "not-found"; message: string }
  | { kind: "unsupported"; message: string };

export function resolveControlCommand(
  parsed: ParsedCommand,
  devices: Device[],
  rooms: Room[],
  contextDeviceIds: string[] = [],
  scopeNames: string[] = [],
  scopeNamesByHouseId: Record<string, string[]> = {},
): Resolution {
  if (parsed.intent !== "CONTROL_DEVICE" || !parsed.action) return { kind: "not-found", message: "That is not a device command." };
  let candidates = devices.filter((device) => !parsed.deviceType || device.type === parsed.deviceType);
  const refersToContext = /\b(it|them|that|those)\b/.test(parsed.normalized);
  if (refersToContext && !parsed.deviceType) candidates = devices.filter((device) => contextDeviceIds.includes(device.id));
  if (parsed.targetText && !refersToContext) {
    const words = parsed.targetText.split(" ").filter((word) => word.length > 1);
    candidates = candidates.filter((device) => {
      const room = rooms.find((item) => item.id === device.roomId);
      const base = `${device.name} ${room?.name ?? ""}`;
      const aliases = device.type === "LIGHT" && /outdoor|perimeter|wall|fence|compound/i.test(base) ? "perimeter fence wall outdoor compound strip" : device.type === "FAN" ? "fan ac air conditioner ventilation" : "";
      const haystack = normalizeCommand(`${base} ${aliases} ${scopeNames.join(" ")} ${(device.houseId ? scopeNamesByHouseId[device.houseId] : [])?.join(" ") ?? ""}`);
      return words.every((word) => haystack.includes(word));
    });
  }
  if (!candidates.length) return { kind: "not-found", message: "I couldn't find an authorized device matching that request." };
  if (candidates.length > 1 && !parsed.group) return { kind: "ambiguous", candidates };
  if (candidates.length > 1 && parsed.group) {
    const supported = candidates.filter((candidate) => {
      const command = mapAction(candidate, parsed.action!);
      return Boolean(command && supportsCommand(candidate, command));
    });
    if (!supported.length) return { kind: "unsupported", message: "None of the matching authorized devices support that operation." };
    const command = mapAction(supported[0], parsed.action);
    return { kind: "resolved", command: { intent: "CONTROL_DEVICE", deviceIds: supported.map((item) => item.id), devices: supported, command: command!, grouped: true } };
  }
  const command = mapAction(candidates[0], parsed.action);
  if (!command || !supportsCommand(candidates[0], command)) {
    return { kind: "unsupported", message: `${candidates[0].name} doesn't support that operation.` };
  }
  return { kind: "resolved", command: { intent: "CONTROL_DEVICE", deviceIds: [candidates[0].id], devices: candidates, command, houseId: candidates[0].houseId } };
}

function mapAction(device: Device, action: NonNullable<ParsedCommand["action"]>): DeviceCommandType | null {
  if (device.type === "GATE") return action === "OPEN" ? "OPEN_GATE" : action === "CLOSE" ? "CLOSE_GATE" : action === "STOP" && supportsCommand(device, "STOP") ? "STOP" : null;
  if (action === "ON") return "TURN_ON";
  if (action === "OFF") return "TURN_OFF";
  if (action === "OPEN") return "OPEN";
  if (action === "CLOSE") return "CLOSE";
  return null;
}

export function filterDevicesForQuery(parsed: ParsedCommand, devices: Device[], rooms: Room[], scopeNames: string[] = []) {
  if (!parsed.targetText) return devices;
  const words = parsed.targetText.split(" ");
  return devices.filter((device) => {
    const room = rooms.find((item) => item.id === device.roomId);
    const haystack = normalizeCommand(`${device.name} ${room?.name ?? ""} ${scopeNames.join(" ")}`);
    return words.every((word) => haystack.includes(word));
  });
}

export function describeStatus(device: Device, state?: DeviceState) {
  if (!state) return `${device.name} has no current status report.`;
  if (state.connectivity === "OFFLINE") return `${device.name} is offline.`;
  if (device.type === "LIGHT" || device.type === "FAN") return `${device.name} is ${state.reported.on ? "on" : "off"}.`;
  if (device.type === "GATE") return `${device.name} is online, but its physical position is unverified.`;
  if (device.type === "MOTION_SENSOR") return `${device.name} reports ${state.reported.motion ? "motion detected" : "no motion"}.`;
  if (device.type === "CONTACT_SENSOR") return `${device.name} reports ${state.reported.open ? "open" : "closed"}.`;
  return `${device.name} is online.`;
}

export function createContext(userKey: string, houseId: string | null): ConversationContext {
  return { userKey, houseId, lastDeviceIds: [], lastHouseId: houseId, pendingConfirmation: null, pendingSecurityConfirmation: null, pendingSecurityTarget: null, pendingClarification: null };
}

export function createConfirmation(command: ResolvedCommand, now = Date.now()): PendingConfirmation {
  return { id: globalThis.crypto?.randomUUID?.() ?? `confirmation-${now}`, command, createdAt: now, expiresAt: now + CONFIRMATION_TTL_MS };
}

export function consumeConfirmation(value: PendingConfirmation | null, now = Date.now()) {
  return value && value.expiresAt > now ? value : null;
}
