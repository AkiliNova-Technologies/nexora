import type { DeviceCommandType } from "@/domain/smart-estate";
import { supportsCommand } from "@/lib/device-capabilities";
import { authorizedDevice, deviceState, devices, rooms, submitCommand } from "@/lib/cloud/repository";

/** Server-only boundary shared by assistant adapters. Repository queries retain house/estate authorization. */
export async function authorizedHouseInventory(userId: string, houseId: string) {
  const [authorizedDevices, authorizedRooms] = await Promise.all([devices(userId, houseId), rooms(userId, houseId)]);
  const stateEntries = await Promise.all(authorizedDevices.map(async device => [device.id, await deviceState(userId, device.id)] as const));
  return { devices: authorizedDevices, rooms: authorizedRooms, states: Object.fromEntries(stateEntries.filter((entry): entry is readonly [string, NonNullable<typeof entry[1]>] => Boolean(entry[1]))) };
}

export async function submitAuthorizedAssistantCommand(userId: string, deviceId: string, command: DeviceCommandType, clientRequestId: string) {
  const [device, state] = await Promise.all([authorizedDevice(userId, deviceId), deviceState(userId, deviceId)]);
  if (!device || !state) throw new Error("DEVICE_NOT_FOUND");
  if (!validateAssistantCapability(device, command)) throw new Error("COMMAND_NOT_ALLOWED");
  if (state.connectivity !== "ONLINE") throw new Error("DEVICE_OFFLINE");
  // Authorization is checked again atomically when the command is inserted.
  const result = await submitCommand(userId, deviceId, { command, clientRequestId });
  if (!result) throw new Error("DEVICE_NOT_FOUND");
  return result;
}

export function validateAssistantCapability(device: Parameters<typeof supportsCommand>[0], command: DeviceCommandType) {
  return supportsCommand(device, command) && (!device.allowedOperations || device.allowedOperations.includes("COMMAND"));
}
