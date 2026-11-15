import type {
  Device,
  DeviceCapability,
  DeviceCommandType,
  DeviceStateValues,
} from "../domain/smart-estate.ts";

const commandCapability: Partial<Record<DeviceCommandType, DeviceCapability["type"]>> = {
  TURN_ON: "POWER",
  TURN_OFF: "POWER",
  SET_BRIGHTNESS: "BRIGHTNESS",
  SET_FAN_SPEED: "FAN_SPEED",
  SET_TARGET_TEMPERATURE: "TARGET_TEMPERATURE",
  LOCK: "LOCK",
  UNLOCK: "LOCK",
  OPEN: "POSITION",
  CLOSE: "POSITION",
  STOP: "POSITION",
  START_RECORDING: "CAMERA_RECORDING",
  STOP_RECORDING: "CAMERA_RECORDING",
  OPEN_GATE: "GATE_CONTROL",
  CLOSE_GATE: "GATE_CONTROL",
  GET_GATE_STATUS: "GATE_CONTROL",
};

export function getCapability<T extends DeviceCapability["type"]>(
  device: Device,
  type: T,
): Extract<DeviceCapability, { type: T }> | undefined {
  return device.capabilities.find(
    (capability): capability is Extract<DeviceCapability, { type: T }> =>
      capability.type === type,
  );
}

export function supportsCommand(device: Device, command: DeviceCommandType) {
  if (device.allowedOperations && !device.allowedOperations.includes("COMMAND")) return false;
  const required = command === "STOP" && device.type === "GATE" ? "GATE_CONTROL" : commandCapability[command];
  return required !== undefined && getCapability(device, required) !== undefined;
}

export function validateCommand(
  device: Device,
  command: DeviceCommandType,
  value?: number,
): string | null {
  const capabilityType = command === "STOP" && device.type === "GATE" ? "GATE_CONTROL" : commandCapability[command];
  if (!capabilityType || !supportsCommand(device, command)) {
    return `${device.name} does not support ${command}`;
  }

  const capability = device.capabilities.find((item) => item.type === capabilityType);
  if (capability && isRangedCapability(capability)) {
    if (value === undefined || !Number.isFinite(value)) return "A numeric value is required";
    if (value < capability.min || value > capability.max) {
      return `Value must be between ${capability.min} and ${capability.max}`;
    }
  }

  return null;
}

function isRangedCapability(
  capability: DeviceCapability,
): capability is Extract<DeviceCapability, { min: number; max: number }> {
  return "min" in capability && "max" in capability;
}

export function applyCommand(
  reported: DeviceStateValues,
  command: DeviceCommandType,
  value?: number,
): DeviceStateValues {
  switch (command) {
    case "TURN_ON": return { ...reported, on: true };
    case "TURN_OFF": return { ...reported, on: false };
    case "SET_BRIGHTNESS": return { ...reported, brightness: value };
    case "SET_FAN_SPEED": return { ...reported, fanSpeed: value };
    case "SET_TARGET_TEMPERATURE": return { ...reported, targetTemperature: value };
    case "LOCK": return { ...reported, locked: true };
    case "UNLOCK": return { ...reported, locked: false };
    case "OPEN": return { ...reported, open: true, positionPercent: 100 };
    case "CLOSE": return { ...reported, open: false, positionPercent: 0 };
    case "START_RECORDING": return { ...reported, recording: true };
    case "STOP_RECORDING": return { ...reported, recording: false };
    case "STOP": return reported;
    case "OPEN_GATE": return { ...reported, lastRequestedOperation: "OPEN_GATE", physicalPositionVerification: "UNVERIFIED" };
    case "CLOSE_GATE": return { ...reported, lastRequestedOperation: "CLOSE_GATE", physicalPositionVerification: "UNVERIFIED" };
    case "GET_GATE_STATUS": return { ...reported, physicalPositionVerification: "UNVERIFIED" };
  }
}
