import { normalizeCommand } from "./command-engine.ts";
import type { ActivityQuestion } from "./types.ts";

// ---------- Multi-step requests ----------

const STEP_VERBS = "turn|switch|arm|disarm|open|close|stop|set|make|dim|brighten|sound|silence|check|kill|show|power|change|tell|what|is|are|list|shut|when|which|who";
const STEP_SPLIT = new RegExp(`\\s*(?:,\\s*)?\\b(?:and then|then|and also|after that)\\b\\s*|\\s*;\\s*|\\s*,?\\s+and\\s+(?=(?:${STEP_VERBS})\\b)|\\s*,\\s*(?=(?:${STEP_VERBS})\\b)`, "i");

/**
 * Split "turn off the lights and arm the house" into separate requests.
 * "and" only splits when a new action verb follows, so "lights and fans" stays together.
 */
export function splitSteps(raw: string): string[] {
  const parts = raw.split(STEP_SPLIT).map((part) => part.trim()).filter(Boolean);
  return parts.length > 1 ? parts : [raw.trim()];
}

// ---------- Routines ----------

export interface RoutineContext {
  /** House the user is looking at; routines act on this house. */
  houseName?: string | null;
  isAdmin: boolean;
  /** Device types the user can command in that house (for skipping irrelevant steps). */
  houseDeviceTypes: Set<string>;
  hasPerimeterStrip: boolean;
  hasGate: boolean;
}

export interface Routine { name: string; steps: string[] }

/** Map everyday phrases to a plan of ordinary commands. Every step still goes through normal permission checks. */
export function matchRoutine(normalized: string, ctx: RoutineContext): Routine | null {
  const house = ctx.houseName;
  const lights = ctx.houseDeviceTypes.has("LIGHT") || ctx.houseDeviceTypes.has("RGB_LIGHT");
  const fans = ctx.houseDeviceTypes.has("FAN");
  const offSteps = [lights ? "turn off all lights" : "", fans ? "turn off all fans" : ""].filter(Boolean);

  if (ctx.isAdmin && /\b(lock ?down|secure the (whole )?estate|estate night mode)\b/.test(normalized)) {
    return { name: "Estate lockdown", steps: ["arm all houses", "arm the perimeter", ctx.hasGate ? "close the gate" : "", ctx.hasPerimeterStrip ? "turn on the perimeter strip" : ""].filter(Boolean) };
  }
  if (/\b(good ?night|bed ?time|going to (bed|sleep)|night mode)\b/.test(normalized)) {
    return { name: "Goodnight", steps: [...offSteps, house ? `arm ${house}` : ""].filter(Boolean) };
  }
  if (/\b(i'm leaving|im leaving|i am leaving|leaving (home|now|the house)|heading out|away mode|i'm going out|im going out|going out now)\b/.test(normalized)) {
    return { name: "Leaving home", steps: [...offSteps, house ? `arm ${house}` : ""].filter(Boolean) };
  }
  if (/\b(i'm home|im home|i am home|i'm back|im back|welcome home|home mode)\b/.test(normalized)) {
    return { name: "Welcome home", steps: [house ? `disarm ${house}` : "", lights ? "turn on all lights" : ""].filter(Boolean) };
  }
  if (/\b(good morning|morning mode)\b/.test(normalized)) {
    return { name: "Good morning", steps: [house ? `disarm ${house}` : "", ctx.isAdmin ? "disarm the perimeter" : "", ctx.isAdmin && ctx.hasPerimeterStrip ? "turn off the perimeter strip" : ""].filter(Boolean) };
  }
  return null;
}

// ---------- Activity questions ----------

export interface ActivityEvent { type: string; severity?: string | null; occurredAt: string; deviceId?: string | null; houseId?: string | null; zone?: string | null }
export interface ActivityCommand { deviceId: string; deviceName?: string | null; type: string; status?: string | null; requestedAt?: string | null; requestedByName?: string | null }
export interface ActivityDevice { id: string; name: string; houseId?: string | null; type: string }
export interface ActivityData {
  now: number;
  events: ActivityEvent[];
  commands: ActivityCommand[];
  devices: ActivityDevice[];
  states: Record<string, { connectivity: string } | undefined>;
  houses: Array<{ id: string; name: string }>;
  /** Only estate administrators receive controller details. */
  controllers?: Array<{ name: string; networkState?: string | null; lastHeartbeatAt?: string | null }>;
}

export function relativeTime(iso: string, now: number) {
  const then = Date.parse(iso);
  if (Number.isNaN(then)) return "at an unknown time";
  const seconds = Math.max(0, Math.round((now - then) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

function windowStart(hours: number, now: number) {
  if (hours > 0) return now - hours * 3_600_000;
  const midnight = new Date(now); midnight.setHours(0, 0, 0, 0);
  return midnight.getTime();
}
const windowLabel = (hours: number) => (hours === 0 ? "today" : hours === 168 ? "in the last week" : `in the last ${hours} hours`);
const humanize = (value: string) => value.toLowerCase().replaceAll("_", " ");
const isMotion = (type: string) => /MOTION_DETECTED/.test(type);
const isAlarm = (event: ActivityEvent) => /ALARM|INTRUSION/.test(event.type) || event.severity === "CRITICAL";
const commandVerb: Record<string, string> = { TURN_ON: "turned on", TURN_OFF: "turned off", OPEN_GATE: "opened", CLOSE_GATE: "closed", OPEN: "opened", CLOSE: "closed", STOP: "stopped", SET_BRIGHTNESS: "dimmed or brightened", SET_RGB: "changed colour", ACTIVATE_SIREN: "sounded", STOP_SIREN: "silenced" };

/** Answer a history or health question from data the user is already authorized to see. */
export function answerActivity(question: ActivityQuestion, normalizedQuestion: string, data: ActivityData): string {
  const { now } = data;
  const houseName = (id?: string | null) => (id ? data.houses.find((house) => house.id === id)?.name ?? "a house" : "the shared estate");
  const deviceName = (id?: string | null) => (id ? data.devices.find((device) => device.id === id)?.name : undefined);
  const namedHouse = data.houses.find((house) => normalizedQuestion.includes(normalizeCommand(house.name)));
  const scopedEvents = namedHouse ? data.events.filter((event) => event.houseId === namedHouse.id) : data.events;
  const sorted = (events: ActivityEvent[]) => [...events].sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));

  switch (question.kind) {
    case "OFFLINE_DEVICES": {
      const offline = data.devices.filter((device) => data.states[device.id] && data.states[device.id]!.connectivity !== "ONLINE");
      const unknown = data.devices.filter((device) => !data.states[device.id]);
      if (!data.devices.length) return "I don't have access to any devices yet.";
      if (!offline.length && !unknown.length) return `All ${data.devices.length} devices are online.`;
      const parts = [];
      if (offline.length) parts.push(`${offline.length} device${offline.length === 1 ? " is" : "s are"} offline: ${offline.map((device) => `${device.name} (${houseName(device.houseId)})`).join(", ")}.`);
      if (unknown.length) parts.push(`${unknown.length} ${unknown.length === 1 ? "has" : "have"} not reported yet: ${unknown.map((device) => device.name).join(", ")}.`);
      return parts.join(" ");
    }
    case "LAST_MOTION": {
      const latest = sorted(scopedEvents.filter((event) => isMotion(event.type)))[0];
      if (!latest) return `I can't see any recorded motion${namedHouse ? ` in ${namedHouse.name}` : ""} in the recent history.`;
      const sensor = deviceName(latest.deviceId);
      return `Motion was last detected ${relativeTime(latest.occurredAt, now)}${sensor ? ` by ${sensor}` : ""} in ${houseName(latest.houseId)}.`;
    }
    case "ALARMS": {
      const since = windowStart(question.hours, now);
      const alarms = sorted(scopedEvents.filter((event) => isAlarm(event) && Date.parse(event.occurredAt) >= since));
      if (!alarms.length) return `No alarms ${windowLabel(question.hours)}${namedHouse ? ` in ${namedHouse.name}` : ""}.`;
      const latest = alarms[0];
      const where = latest.zone ? humanize(latest.zone) : houseName(latest.houseId);
      return `${alarms.length} alarm${alarms.length === 1 ? "" : "s"} ${windowLabel(question.hours)}. The latest was ${relativeTime(latest.occurredAt, now)} in ${where}${deviceName(latest.deviceId) ? `, triggered by ${deviceName(latest.deviceId)}` : ""}.`;
    }
    case "SUMMARY": {
      const since = windowStart(question.hours, now);
      const events = scopedEvents.filter((event) => Date.parse(event.occurredAt) >= since);
      const commands = data.commands.filter((command) => command.requestedAt && Date.parse(command.requestedAt) >= since);
      const motion = events.filter((event) => isMotion(event.type)).length;
      const alarms = events.filter(isAlarm);
      const failed = commands.filter((command) => command.status === "FAILED" || command.status === "TIMEOUT").length;
      const offline = data.devices.filter((device) => data.states[device.id] && data.states[device.id]!.connectivity !== "ONLINE").length;
      const sentences = [
        `${windowLabel(question.hours)[0].toUpperCase()}${windowLabel(question.hours).slice(1)}${namedHouse ? ` in ${namedHouse.name}` : ""}: ${motion} motion event${motion === 1 ? "" : "s"}, ${alarms.length} alarm${alarms.length === 1 ? "" : "s"} and ${commands.length} device command${commands.length === 1 ? "" : "s"}${failed ? ` (${failed} not completed)` : ""}.`,
        alarms.length ? `Latest alarm: ${relativeTime(sorted(alarms)[0].occurredAt, now)}${sorted(alarms)[0].zone ? ` in ${humanize(sorted(alarms)[0].zone!)}` : ""}.` : "",
        offline ? `${offline} device${offline === 1 ? " is" : "s are"} offline right now.` : "All devices are online right now.",
      ];
      return sentences.filter(Boolean).join(" ");
    }
    case "DEVICE_HISTORY": {
      const device = data.devices.find((item) => normalizedQuestion.includes(normalizeCommand(item.name)));
      const relevant = data.commands
        .filter((command) => !device || command.deviceId === device.id)
        .filter((command) => command.requestedAt)
        .sort((a, b) => Date.parse(b.requestedAt!) - Date.parse(a.requestedAt!));
      if (!relevant.length) return device ? `I can't see any recent commands for ${device.name}.` : "I can't see any recent device commands.";
      const describe = (command: ActivityCommand) => `${command.deviceName ?? deviceName(command.deviceId) ?? "A device"} was ${commandVerb[command.type] ?? humanize(command.type)} ${relativeTime(command.requestedAt!, now)}${command.requestedByName ? ` by ${command.requestedByName}` : ""}${command.status && command.status !== "EXECUTED" ? ` (${humanize(command.status)})` : ""}`;
      return device ? `${describe(relevant[0])}.` : `Recent commands: ${relevant.slice(0, 3).map(describe).join("; ")}.`;
    }
    case "CONTROLLER_STATUS": {
      if (!data.controllers) return "Controller details are available to estate administrators. All your devices' own status is shown on the Devices page.";
      if (!data.controllers.length) return "No controller is registered for this estate.";
      return data.controllers.map((controller) => {
        const heartbeat = controller.lastHeartbeatAt ? `last heartbeat ${relativeTime(controller.lastHeartbeatAt, now)}` : "no heartbeat received yet";
        const stale = !controller.lastHeartbeatAt || now - Date.parse(controller.lastHeartbeatAt) > 50_000;
        return `${controller.name} is ${stale ? "offline" : "online"} (${heartbeat}).`;
      }).join(" ");
    }
  }
}
