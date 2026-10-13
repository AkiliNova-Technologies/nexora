import type { Device, DeviceState, House, Room } from "../domain/smart-estate.ts";

export const DEMO_HOUSE_ID = "house-nexora-demo";

export const mockHouses: House[] = [
  { id: DEMO_HOUSE_ID, name: "Nexora Home", timezone: "Africa/Kampala" },
];

export const mockRooms: Room[] = [
  { id: "room-living", houseId: DEMO_HOUSE_ID, name: "Living Room" },
  { id: "room-bedroom", houseId: DEMO_HOUSE_ID, name: "Master Bedroom" },
  { id: "room-kitchen", houseId: DEMO_HOUSE_ID, name: "Kitchen" },
  { id: "room-office", houseId: DEMO_HOUSE_ID, name: "Home Office" },
  { id: "room-theater", houseId: DEMO_HOUSE_ID, name: "Home Theater" },
  { id: "room-outdoor", houseId: DEMO_HOUSE_ID, name: "Outdoor" },
  { id: "room-garage", houseId: DEMO_HOUSE_ID, name: "Garage" },
  { id: "room-entrance", houseId: DEMO_HOUSE_ID, name: "Entrance" },
];

export const mockDevices: Device[] = [
  { id: "dev-living-lights", houseId: DEMO_HOUSE_ID, roomId: "room-living", name: "Living Room Lights", type: "LIGHT", capabilities: [{ type: "POWER" }, { type: "BRIGHTNESS", min: 0, max: 100 }] },
  { id: "dev-floor-lamp", houseId: DEMO_HOUSE_ID, roomId: "room-living", name: "Floor Lamp", type: "LIGHT", capabilities: [{ type: "POWER" }] },
  { id: "dev-living-ac", houseId: DEMO_HOUSE_ID, roomId: "room-living", name: "Air Conditioner", type: "THERMOSTAT", capabilities: [{ type: "POWER" }, { type: "TARGET_TEMPERATURE", min: 16, max: 30, unit: "CELSIUS" }] },
  { id: "dev-living-blinds", houseId: DEMO_HOUSE_ID, roomId: "room-living", name: "Window Blinds", type: "BLIND", capabilities: [{ type: "POSITION" }] },
  { id: "dev-living-soundbar", houseId: DEMO_HOUSE_ID, roomId: "room-living", name: "Living Soundbar", type: "SPEAKER", capabilities: [{ type: "POWER" }] },
  { id: "dev-bedroom-thermostat", houseId: DEMO_HOUSE_ID, roomId: "room-bedroom", name: "Bedroom Thermostat", type: "THERMOSTAT", capabilities: [{ type: "POWER" }, { type: "TARGET_TEMPERATURE", min: 16, max: 30, unit: "CELSIUS" }] },
  { id: "dev-kitchen-plug", houseId: DEMO_HOUSE_ID, roomId: "room-kitchen", name: "Kitchen Smart Plug", type: "SMART_PLUG", capabilities: [{ type: "POWER" }] },
  { id: "dev-garage-camera", houseId: DEMO_HOUSE_ID, roomId: "room-garage", name: "Garage Camera", type: "CAMERA", capabilities: [{ type: "POWER" }, { type: "CAMERA_STREAM" }, { type: "CAMERA_RECORDING" }] },
  { id: "dev-front-door-sensor", houseId: DEMO_HOUSE_ID, roomId: "room-entrance", name: "Front Door Sensor", type: "CONTACT_SENSOR", capabilities: [] },
  { id: "dev-office-fan", houseId: DEMO_HOUSE_ID, roomId: "room-office", name: "Office Fan", type: "FAN", capabilities: [{ type: "POWER" }, { type: "FAN_SPEED", min: 0, max: 100 }] },
  { id: "dev-front-door-lock", houseId: DEMO_HOUSE_ID, roomId: "room-entrance", name: "Front Door Lock", type: "LOCK", capabilities: [{ type: "LOCK" }] },
  { id: "dev-living-motion", houseId: DEMO_HOUSE_ID, roomId: "room-living", name: "Living Room Motion", type: "MOTION_SENSOR", capabilities: [] },
  { id: "dev-back-door-sensor", houseId: DEMO_HOUSE_ID, roomId: "room-kitchen", name: "Back Door Sensor", type: "CONTACT_SENSOR", capabilities: [] },
];

const initialReported: Record<string, DeviceState["reported"]> = {
  "dev-living-lights": { on: true, brightness: 78, powerWatts: 14 },
  "dev-floor-lamp": { on: true },
  "dev-living-ac": { on: true, targetTemperature: 22, temperature: 22 },
  "dev-living-blinds": { open: false, positionPercent: 0 },
  "dev-living-soundbar": { on: true, playing: true },
  "dev-bedroom-thermostat": { on: true, targetTemperature: 24, temperature: 24 },
  "dev-kitchen-plug": { on: true, powerWatts: 740 },
  "dev-garage-camera": { on: false, recording: false },
  "dev-front-door-sensor": { open: false, batteryPercent: 86 },
  "dev-office-fan": { on: false, fanSpeed: 35 },
  "dev-front-door-lock": { locked: true },
  "dev-living-motion": { batteryPercent: 72 },
  "dev-back-door-sensor": { open: true, batteryPercent: 82 },
};

export const mockDeviceStates: DeviceState[] = mockDevices.map((device) => ({
  deviceId: device.id,
  connectivity: device.id === "dev-garage-camera" ? "OFFLINE" : "ONLINE",
  desired: null,
  reported: initialReported[device.id] ?? {},
  commandStatus: "IDLE",
  lastReportedAt: "2026-10-13T09:00:00.000Z",
}));

export const featuredDeviceIds = [
  "dev-living-lights",
  "dev-bedroom-thermostat",
  "dev-kitchen-plug",
  "dev-garage-camera",
  "dev-front-door-sensor",
  "dev-office-fan",
] as const;
