import type { Device, DeviceCommandType, DeviceState, Room } from "../../domain/smart-estate.ts";
import { supportsCommand } from "../device-capabilities.ts";
import type { ActivityQuestion, CommandParameters, ConversationContext, NamedColor, ParsedCommand, PendingConfirmation, ResolvedCommand } from "./types.ts";

/** Colours the assistant understands, longest names first so "warm white" wins over "white". */
export const NAMED_COLORS: NamedColor[] = [
  { name: "warm white", r: 255, g: 170, b: 80 },
  { name: "white", r: 255, g: 255, b: 255 },
  { name: "warm", r: 255, g: 170, b: 80 },
  { name: "red", r: 255, g: 0, b: 0 },
  { name: "green", r: 0, g: 200, b: 80 },
  { name: "blue", r: 40, g: 110, b: 255 },
  { name: "orange", r: 255, g: 110, b: 0 },
  { name: "yellow", r: 255, g: 200, b: 0 },
  { name: "purple", r: 150, g: 60, b: 255 },
  { name: "pink", r: 255, g: 80, b: 160 },
  { name: "cyan", r: 0, g: 200, b: 220 },
];
export const DEFAULT_SIREN_SECONDS = 10;
// "it" as a reference to an earlier device; "it's dark" is not one.
const PRONOUN = /\b(it|them|that|those)\b(?!')/;

function detectColor(normalized: string) {
  return NAMED_COLORS.find((color) => new RegExp(`\\b${color.name}\\b`).test(normalized));
}

/** Percent from the raw text ("40%") or the normalized text ("40 percent", "brightness 40", "to 40"). */
function detectPercent(raw: string, normalized: string) {
  const match = raw.match(/(\d{1,3})\s*%/) ?? normalized.match(/\b(\d{1,3})\s*percent\b/) ?? normalized.match(/\bbrightness\s+(?:to\s+|at\s+)?(\d{1,3})\b/) ?? normalized.match(/\b(?:dim|brighten|set|change|make)\b.*\b(?:to|at)\s+(\d{1,3})\b/);
  return match ? Math.max(0, Math.min(100, Number(match[1]))) : undefined;
}

/** Recognise questions about history and health rather than commands. */
export function parseActivityQuestion(normalized: string): ActivityQuestion | null {
  const hours = /\btoday\b/.test(normalized) ? 0 : /\b(this|last|past) week\b/.test(normalized) ? 168 : Number(normalized.match(/\b(?:last|past)\s+(\d{1,3})\s+hours?\b/)?.[1] ?? 24);
  if (/\b(controller|hub|esp32)\b.*\b(online|offline|status|connected|working|up|down)\b|\bis the (controller|hub|system) (online|up|working|connected|down)\b/.test(normalized)) return { kind: "CONTROLLER_STATUS" };
  if (/\b(which|what|any|are there|list|show)\b.*\b(offline|disconnected|not working|unavailable|not responding)\b/.test(normalized)) return { kind: "OFFLINE_DEVICES" };
  if (/\b(when|last|latest|recent)\b.*\bmotion\b|\bmotion\b.*\b(last|latest)\b|\b(has|was) there (been )?(any )?motion\b/.test(normalized)) return { kind: "LAST_MOTION" };
  if (/\b(any|were there|have there been|last|recent|latest|how many)\b.*\b(alarms?|alerts?|intrusions?|break ins?|triggered)\b/.test(normalized)) return { kind: "ALARMS", hours };
  if (/\bwhat happened\b|\bactivity\b|\bwhile i was (away|out|gone)\b|\bsummary\b|\banything (happen|new)\b|\bwhat did i miss\b|\bany updates?\b/.test(normalized)) return { kind: "SUMMARY", hours };
  if (/\bwho\b.*\b(turned|switched|opened|closed|armed|disarmed|used|changed)\b|\bwhen was\b.*\b(turned|switched|opened|closed|used|last)\b/.test(normalized)) return { kind: "DEVICE_HISTORY" };
  return null;
}

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
  const activity = parseActivityQuestion(normalized);
  if (activity) return { raw, normalized, intent: "ACTIVITY", activity };
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

  // Siren: sound/test/trigger to activate, stop/silence/turn off to stop.
  if (deviceType === "SIREN") {
    const stop = /\b(stop|silence|quiet|mute|off|shut|cancel)\b/.test(normalized);
    const start = /\b(sound|ring|trigger|test|activate|start|on|blast)\b/.test(normalized);
    if (stop || start) {
      const seconds = normalized.match(/\bfor\s+(\d{1,3})\s*(?:seconds?|secs?|s)\b/)?.[1];
      return { raw, normalized, intent: "CONTROL_DEVICE", action: stop ? "OFF" : "ON", deviceType, durationSeconds: seconds ? Number(seconds) : undefined, targetText: extractTarget(normalized) };
    }
  }
  const color = detectColor(normalized);
  if (color && /\b(make|set|change|turn|switch|colou?r|paint|go)\b/.test(normalized) && (deviceType || PRONOUN.test(normalized) || /\bleds?\b/.test(normalized))) {
    return { raw, normalized, intent: "CONTROL_DEVICE", action: "SET_COLOR", color, deviceType: deviceType ?? (PRONOUN.test(normalized) ? undefined : "RGB_LIGHT"), targetText: extractTarget(normalized.replace(new RegExp(`\\b${color.name}\\b`), " ")) };
  }
  const percent = detectPercent(raw, normalized);
  const dim = /\b(dim|dimmer|lower)\b/.test(normalized), brighten = /\b(brighten|brighter|full brightness|max(?:imum)? brightness)\b/.test(normalized);
  const lightOrPronoun = deviceType === "LIGHT" || deviceType === "RGB_LIGHT" || PRONOUN.test(normalized);
  const brightnessWord = dim || brighten || /\bbrightness\b/.test(normalized);
  // A bare number only means brightness when a light (or "it") is named.
  if ((brightnessWord && (lightOrPronoun || !deviceType)) || (percent !== undefined && /\b(set|make|turn|change)\b/.test(normalized) && lightOrPronoun)) {
    const value = percent ?? (dim ? 25 : 100);
    return { raw, normalized, intent: "CONTROL_DEVICE", action: "SET_BRIGHTNESS", value, deviceType: deviceType ?? (PRONOUN.test(normalized) ? undefined : "LIGHT"), group: /\b(all|every|both|everything)\b/.test(normalized) ? "ALL" : undefined, targetText: extractTarget(normalized) };
  }
  const action = /\b(turn|switch|power)(?:\s+(?:it|them|that|those|everything))?\s+on\b|\blights? on\b|\bfans? on\b|\blight up\b|\b(it's|its|it is|too) dark\b/.test(normalized) ? "ON"
    : /\b(turn|switch|power)(?:\s+(?:it|them|that|those|everything))?\s+off\b|\blights? off\b|\bfans? off\b|\blights? out\b|\bkill\b|\bshut (off|down)\b/.test(normalized) ? "OFF"
    : /\b(turn|switch|power)\b.*\bon$/.test(normalized) ? "ON"
    : /\b(turn|switch|power)\b.*\boff$/.test(normalized) ? "OFF"
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
  if (/\bsiren\b|\b(sound|ring|trigger|test|silence|stop)\b.*\balarm\b/.test(value)) return "SIREN";
  if (/\b(strip|led strip|leds|rgb)\b/.test(value)) return "RGB_LIGHT";
  if (/\b(gate|entrance)\b/.test(value)) return "GATE";
  if (/\b(dark|can't see|cant see)\b/.test(value)) return "LIGHT";
  if (/\b(light|lights|lighting|lamp|lamps|perimeter|fence lights|wall lights|outdoor lighting|compound lights)\b/.test(value)) return "LIGHT";
  if (/\b(fan|fans|ac|air conditioner|ventilation)\b/.test(value)) return "FAN";
  if (/\b(motion|motion sensor|motion sensors)\b/.test(value)) return "MOTION_SENSOR";
  if (/\b(sensor|sensors|security)\b/.test(value)) return "CONTACT_SENSOR";
  return undefined;
}

function extractTarget(value: string) {
  return value
    .replace(/\b\d{1,3}\s*percent\b|\bfor\s+\d{1,3}\s*(?:seconds?|secs?|s)\b|\b(?:to|at)\s+\d{1,3}(?:\s*percent)?\b|\bbrightness\s+\d{1,3}\b/g, " ")
    .replace(/\b(turn|switch|power|open|close|stop|arm|disarm|check|show|list|tell|what|is|are|me|my|all|every|both|interior|available|connected|the|on|off|status|state|devices?|controllers?|in|at|for|please|could|would|you|set|make|change|to|dim|dimmer|lower|brighten|brighter|brightness|full|max|maximum|colou?r|paint|go|sound|ring|trigger|test|activate|start|silence|quiet|mute|shut|down|kill|out|up|light up|dark|too|it's|its|it|can't|cant|see|cancel|blast|percent)\b/g, " ")
    .replace(/\b(light|lights|lighting|lamp|lamps|fan|fans|ac|air conditioner|ventilation|gate|motion|sensor|sensors|security|house|estate|siren|alarm|strip|led|leds|rgb)\b/g, " ")
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
  options: { preferHouseId?: string | null; scopeHouseId?: string | null } = {},
): Resolution {
  if (parsed.intent !== "CONTROL_DEVICE" || !parsed.action) return { kind: "not-found", message: "That is not a device command." };
  // "Lights" covers ordinary and RGB lights, so the perimeter strip answers to "perimeter lights".
  const family = parsed.deviceType === "LIGHT" ? ["LIGHT", "RGB_LIGHT"] : parsed.deviceType ? [parsed.deviceType] : null;
  let candidates = devices.filter((device) => !family || family.includes(device.type));
  const refersToContext = PRONOUN.test(parsed.normalized);
  if (refersToContext && !parsed.deviceType) candidates = devices.filter((device) => contextDeviceIds.includes(device.id));
  if (parsed.targetText && !refersToContext) {
    const words = parsed.targetText.split(" ").filter((word) => word.length > 1 || /^\d$/.test(word));
    candidates = candidates.filter((device) => {
      const room = rooms.find((item) => item.id === device.roomId);
      const base = `${device.name} ${room?.name ?? ""}`;
      const shared = device.estateId && !device.houseId;
      const aliases = [
        device.type === "RGB_LIGHT" || (device.type === "LIGHT" && /outdoor|perimeter|wall|fence|compound/i.test(base)) ? "perimeter fence wall outdoor compound strip led" : "",
        device.type === "FAN" ? `fan ac air conditioner ventilation${shared ? " big estate shared" : ""}` : "",
        shared ? "estate shared compound" : "",
      ].join(" ");
      const haystack = normalizeCommand(`${base} ${aliases} ${scopeNames.join(" ")} ${(device.houseId ? scopeNamesByHouseId[device.houseId] : [])?.join(" ") ?? ""}`);
      const haystackWords = haystack.split(" ");
      return words.every((word) => (/^\d+$/.test(word) ? haystackWords.includes(word) : haystack.includes(word)));
    });
  }
  // "All lights" without a named place means the house the user is looking at.
  if (parsed.group === "ALL" && options.scopeHouseId && !parsed.targetText) {
    const inHouse = candidates.filter((device) => device.houseId === options.scopeHouseId);
    if (inHouse.length) candidates = inHouse;
  }
  if (!candidates.length) return { kind: "not-found", message: "I couldn't find an authorized device matching that request." };
  // The same name in several houses: prefer the house the user is looking at.
  if (candidates.length > 1 && !parsed.group && options.preferHouseId && new Set(candidates.map((device) => device.houseId ?? "estate")).size > 1) {
    const preferred = candidates.filter((device) => device.houseId === options.preferHouseId);
    if (preferred.length) candidates = preferred;
  }
  // Only offer choices that can actually do what was asked ("make the light blue" when no light has colour).
  if (candidates.length > 1 && !parsed.group) {
    const capable = candidates.filter((candidate) => {
      const command = mapAction(candidate, parsed.action!);
      return Boolean(command && supportsCommand(candidate, command));
    });
    if (!capable.length) {
      const what = parsed.action === "SET_COLOR" ? "colour changes" : parsed.action === "SET_BRIGHTNESS" ? "brightness control" : "that operation";
      return { kind: "unsupported", message: `None of the matching devices support ${what}.` };
    }
    candidates = capable;
  }
  if (candidates.length > 1 && !parsed.group) return { kind: "ambiguous", candidates };
  if (candidates.length > 1 && parsed.group) {
    const supported = candidates.filter((candidate) => {
      const command = mapAction(candidate, parsed.action!);
      return Boolean(command && supportsCommand(candidate, command));
    });
    if (!supported.length) return { kind: "unsupported", message: "None of the matching authorized devices support that operation." };
    const command = mapAction(supported[0], parsed.action);
    return { kind: "resolved", command: { intent: "CONTROL_DEVICE", deviceIds: supported.map((item) => item.id), devices: supported, command: command!, parameters: commandParameters(supported[0], command!, parsed), grouped: true } };
  }
  const command = mapAction(candidates[0], parsed.action);
  if (!command || !supportsCommand(candidates[0], command)) {
    const what = parsed.action === "SET_COLOR" ? "colour changes" : parsed.action === "SET_BRIGHTNESS" ? "brightness control" : "that operation";
    return { kind: "unsupported", message: `${candidates[0].name} doesn't support ${what}.` };
  }
  return { kind: "resolved", command: { intent: "CONTROL_DEVICE", deviceIds: [candidates[0].id], devices: candidates, command, parameters: commandParameters(candidates[0], command, parsed), houseId: candidates[0].houseId } };
}

function commandParameters(device: Device, command: DeviceCommandType, parsed: ParsedCommand): CommandParameters | undefined {
  if (command === "SET_BRIGHTNESS") {
    const capability = device.capabilities.find((item) => item.type === "BRIGHTNESS") as { min?: number; max?: number } | undefined;
    const value = Math.round(parsed.value ?? 100);
    return { value: Math.max(capability?.min ?? 0, Math.min(capability?.max ?? 100, value)) };
  }
  if (command === "SET_RGB" && parsed.color) return { r: parsed.color.r, g: parsed.color.g, b: parsed.color.b };
  if (command === "ACTIVATE_SIREN") {
    const capability = device.capabilities.find((item) => item.type === "SIREN_CONTROL") as { maxDurationSeconds?: number } | undefined;
    const max = capability?.maxDurationSeconds ?? DEFAULT_SIREN_SECONDS;
    return { durationSeconds: Math.max(1, Math.min(max, parsed.durationSeconds ?? DEFAULT_SIREN_SECONDS)) };
  }
  return undefined;
}

function mapAction(device: Device, action: NonNullable<ParsedCommand["action"]>): DeviceCommandType | null {
  if (action === "SET_BRIGHTNESS") return "SET_BRIGHTNESS";
  if (action === "SET_COLOR") return "SET_RGB";
  if (device.type === "SIREN") return action === "ON" ? "ACTIVATE_SIREN" : action === "OFF" || action === "STOP" ? "STOP_SIREN" : null;
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
  if (device.type === "RGB_LIGHT") return `${device.name} is ${state.reported.on ? `on${state.reported.brightness != null ? ` at ${state.reported.brightness}% brightness` : ""}` : "off"}.`;
  if (device.type === "SIREN") return `${device.name} is ${state.reported.on ? "sounding" : "silent"}.`;
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
