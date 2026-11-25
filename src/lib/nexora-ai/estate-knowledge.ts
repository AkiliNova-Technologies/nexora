import type { Device, DeviceState, Estate, House, HouseSecurityMode, Room } from "../../domain/smart-estate.ts";
import { supportsCommand } from "../device-capabilities.ts";
import { normalizeCommand } from "./command-engine.ts";

export type Availability = "OPERATIONAL" | "OFFLINE" | "UNCONFIGURED";

export interface KnowledgeDevice {
  device: Device;
  state?: DeviceState;
  house?: House;
  room?: Room;
  aliases: string[];
  availability: Availability;
  operations: string[];
}

export interface EstateKnowledge {
  estate?: Estate;
  houses: House[];
  devices: KnowledgeDevice[];
  securityModes: HouseSecurityMode[];
  gaps: string[];
}

const typeAliases: Partial<Record<Device["type"], string[]>> = {
  LIGHT: ["light", "lamp"],
  FAN: ["fan", "ventilation", "air conditioner", "ac"],
  GATE: ["gate", "main gate", "estate gate", "rolling gate", "sliding gate"],
  MOTION_SENSOR: ["motion sensor", "pir sensor", "intrusion sensor"],
  CONTACT_SENSOR: ["entrance sensor", "door sensor", "security sensor", "ultrasonic sensor"],
};

export function buildEstateKnowledge(input: {
  estate?: Estate;
  houses: House[];
  rooms: Room[];
  devices: Device[];
  states: Record<string, DeviceState | undefined>;
  securityModes?: HouseSecurityMode[];
}): EstateKnowledge {
  const roomById = new Map(input.rooms.map((room) => [room.id, room]));
  const houseById = new Map(input.houses.map((house) => [house.id, house]));
  const devices = input.devices.map((device): KnowledgeDevice => {
    const room = device.roomId ? roomById.get(device.roomId) : undefined;
    const house = device.houseId ? houseById.get(device.houseId) : undefined;
    const state = input.states[device.id];
    const aliases = new Set([device.name, room?.name, house?.name, ...(typeAliases[device.type] ?? [])].filter(Boolean) as string[]);
    if (device.type === "LIGHT" && /outdoor|perimeter|wall|fence|compound/i.test(`${device.name} ${room?.name ?? ""}`)) {
      ["perimeter lights", "fence lights", "wall lights", "outdoor lighting", "compound lights"].forEach((alias) => aliases.add(alias));
    }
    return {
      device,
      state,
      house,
      room,
      aliases: [...aliases].map(normalizeCommand),
      availability: !state ? "UNCONFIGURED" : state.connectivity === "ONLINE" ? "OPERATIONAL" : "OFFLINE",
      operations: ["TURN_ON", "TURN_OFF", "OPEN_GATE", "CLOSE_GATE", "GET_GATE_STATUS", "STOP"].filter((operation) => supportsCommand(device, operation as never)),
    };
  });
  // An absent resource may be unauthorized rather than unconfigured. Never infer or
  // disclose estate topology beyond the authenticated inventory returned by the API.
  return { estate: input.estate, houses: input.houses, devices, securityModes: input.securityModes ?? [], gaps: [] };
}

export function describeCapabilities(knowledge: EstateKnowledge, topic: "GENERAL" | "SECURITY" | "GATE" | "DEVICES" | "EXAMPLES" = "GENERAL") {
  const operational = knowledge.devices.filter((item) => item.availability === "OPERATIONAL");
  const offline = knowledge.devices.filter((item) => item.availability === "OFFLINE");
  const unconfigured = knowledge.devices.filter((item) => item.availability === "UNCONFIGURED");
  const lights = operational.filter((item) => item.device.type === "LIGHT" || item.device.type === "RGB_LIGHT");
  const strips = operational.filter((item) => item.device.type === "RGB_LIGHT");
  const sirens = operational.filter((item) => item.device.type === "SIREN");
  const fans = operational.filter((item) => item.device.type === "FAN");
  const gates = operational.filter((item) => item.device.type === "GATE" && item.device.allowedOperations?.includes("COMMAND") !== false);
  const sensors = operational.filter((item) => item.device.type === "MOTION_SENSOR" || item.device.type === "CONTACT_SENSOR");
  if (topic === "EXAMPLES") return "Try: ‘turn on the kitchen light’, ‘kill the lights’, ‘make the perimeter strip blue’, ‘dim the strip to 30%’, ‘turn off the lights and arm the house’, ‘goodnight’, ‘I'm leaving’, ‘which devices are offline?’, ‘when was motion last detected?’ or ‘what happened today?’. Gate movement, the siren and security changes ask for confirmation first.";
  if (topic === "SECURITY") return `I can check ${knowledge.securityModes.length ? "and change" : "the available"} house security state and report actual authorized sensor events. I can see ${sensors.length} operational security sensor${sensors.length === 1 ? "" : "s"}. Compound security is not available unless an estate-level security zone is registered by the backend.`;
  if (topic === "GATE") return gates.length ? "I can open or close the authorized estate gate after confirmation and request controller status. The controller does not verify physical gate position, and stop is unavailable unless the registered gate exposes that operation." : "No authorized operational estate gate is currently registered.";
  if (topic === "DEVICES") return summarizeInventory(knowledge);
  const abilities = [
    lights.length ? `control ${lights.length} operational light${lights.length === 1 ? "" : "s"}` : "",
    strips.length ? "change the perimeter strip's colour and brightness" : "",
    sirens.length ? "sound or silence the siren after confirmation" : "",
    fans.length ? `switch ${fans.length} fan${fans.length === 1 ? "" : "s"} on or off` : "",
    gates.length ? "operate the main gate with confirmation" : "",
    sensors.length ? "check security sensors and alerts" : "",
    knowledge.securityModes.length ? "manage supported house security modes" : "",
    "run routines such as ‘goodnight’ or ‘I'm leaving’",
    "answer questions such as ‘what happened today?’",
  ].filter(Boolean);
  const unavailable = offline.length ? ` ${offline.length} configured device${offline.length === 1 ? " is" : "s are"} currently offline.` : "";
  const withoutState = unconfigured.length ? ` ${unconfigured.length} visible device${unconfigured.length === 1 ? " has" : "s have"} no current state report.` : "";
  return `Hello! I'm Nexora AI. From your authorized inventory, I can ${abilities.length ? abilities.join(", ") : "report connected devices"}.${unavailable}${withoutState} Ask ‘give me examples of commands’ for ideas.`;
}

export function summarizeInventory(knowledge: EstateKnowledge) {
  if (!knowledge.devices.length) return "I don't currently have access to any registered devices.";
  const byHouse = knowledge.houses.map((house) => {
    const devices = knowledge.devices.filter((item) => item.device.houseId === house.id);
    return `${house.name}: ${devices.map((item) => `${item.device.name} (${item.availability.toLowerCase()})`).join(", ") || "no registered devices"}`;
  });
  const shared = knowledge.devices.filter((item) => item.device.estateId);
  if (shared.length) byHouse.push(`Shared estate: ${shared.map((item) => `${item.device.name} (${item.availability.toLowerCase()})`).join(", ")}`);
  return byHouse.join(". ") + ".";
}
