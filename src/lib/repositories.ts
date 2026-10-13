import type { Device, DeviceId, DeviceState, House, HouseId, Room } from "../domain/smart-estate.ts";
import { mockDevices, mockDeviceStates, mockHouses, mockRooms } from "../data/mock-smart-estate.ts";

export interface HouseRepository {
  list(): Promise<House[]>;
  get(id: HouseId): Promise<House | undefined>;
}

export interface RoomRepository {
  listByHouse(houseId: HouseId): Promise<Room[]>;
}

export interface DeviceRepository {
  listByHouse(houseId: HouseId): Promise<Device[]>;
  get(id: DeviceId): Promise<Device | undefined>;
  getState(id: DeviceId): Promise<DeviceState | undefined>;
}

export const mockHouseRepository: HouseRepository = {
  async list() { return mockHouses; },
  async get(id) { return mockHouses.find((house) => house.id === id); },
};

export const mockRoomRepository: RoomRepository = {
  async listByHouse(houseId) { return mockRooms.filter((room) => room.houseId === houseId); },
};

export const mockDeviceRepository: DeviceRepository = {
  async listByHouse(houseId) { return mockDevices.filter((device) => device.houseId === houseId); },
  async get(id) { return mockDevices.find((device) => device.id === id); },
  async getState(id) { return mockDeviceStates.find((state) => state.deviceId === id); },
};
