export type HouseId = string;
export type RoomId = string;
export type DeviceId = string;

export interface House {
  id: HouseId;
  name: string;
  timezone: string;
}

export interface Room {
  id: RoomId;
  houseId: HouseId;
  name: string;
}

export type DeviceType =
  | "LIGHT"
  | "FAN"
  | "THERMOSTAT"
  | "SMART_PLUG"
  | "CAMERA"
  | "CONTACT_SENSOR"
  | "MOTION_SENSOR"
  | "LOCK"
  | "BLIND"
  | "SPEAKER"
  | "TEMPERATURE_SENSOR"
  | "HUMIDITY_SENSOR";

export type DeviceCapability =
  | { type: "POWER" }
  | { type: "BRIGHTNESS"; min: number; max: number }
  | { type: "FAN_SPEED"; min: number; max: number }
  | { type: "TARGET_TEMPERATURE"; min: number; max: number; unit: "CELSIUS" }
  | { type: "LOCK" }
  | { type: "POSITION" }
  | { type: "CAMERA_STREAM" }
  | { type: "CAMERA_RECORDING" };

export interface Device {
  id: DeviceId;
  houseId: HouseId;
  roomId?: RoomId;
  name: string;
  type: DeviceType;
  capabilities: DeviceCapability[];
}

export type DeviceConnectivity = "ONLINE" | "OFFLINE";
export type DeviceCommandStatus =
  | "IDLE"
  | "PENDING"
  | "ACCEPTED"
  | "EXECUTED"
  | "FAILED"
  | "TIMEOUT";

export interface DeviceStateValues {
  on?: boolean;
  brightness?: number;
  fanSpeed?: number;
  targetTemperature?: number;
  temperature?: number;
  humidity?: number;
  powerWatts?: number;
  batteryPercent?: number;
  locked?: boolean;
  open?: boolean;
  positionPercent?: number;
  recording?: boolean;
  playing?: boolean;
}

export interface DeviceState {
  deviceId: DeviceId;
  connectivity: DeviceConnectivity;
  desired: DeviceStateValues | null;
  reported: DeviceStateValues;
  commandStatus: DeviceCommandStatus;
  lastReportedAt: string;
}

export type DeviceCommandType =
  | "TURN_ON"
  | "TURN_OFF"
  | "SET_BRIGHTNESS"
  | "SET_FAN_SPEED"
  | "SET_TARGET_TEMPERATURE"
  | "LOCK"
  | "UNLOCK"
  | "OPEN"
  | "CLOSE"
  | "STOP"
  | "START_RECORDING"
  | "STOP_RECORDING";

export interface DeviceCommand {
  id: string;
  deviceId: DeviceId;
  type: DeviceCommandType;
  parameters?: { value: number };
  status: DeviceCommandStatus;
  requestedAt: string;
  completedAt?: string;
  error?: string;
}

export interface DeviceTelemetry {
  id: string;
  deviceId: DeviceId;
  metric: "TEMPERATURE" | "HUMIDITY" | "POWER" | "ENERGY" | "BATTERY";
  value: number;
  unit: string;
  recordedAt: string;
}

export interface SecurityEvent {
  id: string;
  houseId: HouseId;
  deviceId?: DeviceId;
  type: "DOOR_OPENED" | "DOOR_CLOSED" | "MOTION_DETECTED" | "DEVICE_OFFLINE" | "LOCK_CHANGED" | "ALARM";
  severity: "INFO" | "WARNING" | "CRITICAL";
  occurredAt: string;
  acknowledgedAt?: string;
}
