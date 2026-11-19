export type HouseId = string;
export type RoomId = string;
export type DeviceId = string;
export type EstateId = string;

export interface House {
  id: HouseId;
  name: string;
  timezone: string;
}
export interface Estate { id: EstateId; name: string; timezone: string }

export type SecurityMode = "DISARMED" | "ARMED_HOME" | "ARMED_AWAY";
export interface HouseSecurityMode { houseId: HouseId; mode: SecurityMode; version: number; updatedAt: string }
export interface SecuritySensorPolicy { houseId: HouseId; deviceId: DeviceId; enabled: boolean; monitorArmedHome: boolean; monitorArmedAway: boolean; version: number; updatedAt: string; metadata: Record<string, unknown> }

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
  | "HUMIDITY_SENSOR"
  | "ULTRASONIC_SENSOR"
  | "RGB_LIGHT"
  | "SIREN"
  | "GATE";

export type DeviceCapability =
  | { type: "POWER" }
  | { type: "BRIGHTNESS"; min: number; max: number }
  | { type: "FAN_SPEED"; min: number; max: number }
  | { type: "TARGET_TEMPERATURE"; min: number; max: number; unit: "CELSIUS" }
  | { type: "LOCK" }
  | { type: "POSITION" }
  | { type: "CAMERA_STREAM" }
  | { type: "CAMERA_RECORDING" }
  | { type: "RGB_COLOR" }
  | { type: "SIREN_CONTROL"; maxDurationSeconds: number }
  | { type: "GATE_CONTROL" };

export interface Device {
  id: DeviceId;
  houseId?: HouseId;
  estateId?: EstateId;
  roomId?: RoomId;
  name: string;
  type: DeviceType;
  capabilities: DeviceCapability[];
  executionMode?: "SIMULATED" | "PHYSICAL";
  /** Effective operations supplied by the authenticated backend. Absent in local mock data. */
  allowedOperations?: Array<"VIEW" | "READ_STATE" | "COMMAND">;
}

export type DeviceConnectivity = "ONLINE" | "OFFLINE" | "UNAVAILABLE" | "DEGRADED" | "UNKNOWN";
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
  motion?: boolean;
  simulation?: boolean;
  controllerExecution?: "EXECUTED";
  lastRequestedOperation?: "OPEN_GATE" | "CLOSE_GATE" | "GET_GATE_STATUS";
  physicalPositionVerification?: "UNVERIFIED";
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
  | "STOP_RECORDING"
  | "SET_RGB"
  | "ACTIVATE_SIREN"
  | "STOP_SIREN"
  | "OPEN_GATE"
  | "CLOSE_GATE"
  | "GET_GATE_STATUS";

export interface DeviceCommand {
  id: string;
  deviceId: DeviceId;
  type: DeviceCommandType;
  parameters?: { value: number } | null;
  status: DeviceCommandStatus;
  requestedAt: string;
  completedAt?: string | null;
  error?: string | null;
  requestedBy?: string | null;
  physicalPositionVerification?: "UNVERIFIED" | null;
}

export interface GateResource { device: Device; state: DeviceState; physicalPositionVerification: "UNVERIFIED" }

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
  type: "DOOR_OPENED" | "DOOR_CLOSED" | "MOTION_DETECTED" | "MOTION_CLEARED" | "DEVICE_OFFLINE" | "LOCK_CHANGED" | "ALARM";
  severity: "INFO" | "WARNING" | "CRITICAL";
  occurredAt: string;
  receivedAt?: string;
  metadata?: Record<string, unknown>;
  acknowledgedAt?: string;
}
