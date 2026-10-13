import type {
  Device,
  DeviceCommand,
  DeviceCommandType,
  DeviceId,
  DeviceState,
  House,
  Room,
} from "../../domain/smart-estate.ts";

export const API_PREFIX = "/api/v1" as const;

export interface ApiErrorResponse {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

export interface RegisterRequest { name: string; email: string; password: string }
export interface LoginRequest { email: string; password: string }
export interface UserResponse { id: string; name: string; email: string; role: "USER" }

export interface DeviceCommandRequest {
  command: DeviceCommandType;
  parameters?: { value: number };
  clientRequestId: string;
}

export interface DashboardResponse {
  houseId: string;
  totalDevices: number;
  onlineDevices: number;
  activeAutomations: number;
  securityMode: "ARMED" | "HOME" | "DISARMED";
  energyTodayKwh: number;
}

export interface ApiContract {
  "POST /auth/register": { request: RegisterRequest; response: UserResponse };
  "POST /auth/login": { request: LoginRequest; response: UserResponse };
  "POST /auth/logout": { request: undefined; response: undefined };
  "GET /me": { request: undefined; response: UserResponse };
  "GET /houses": { request: undefined; response: House[] };
  "GET /houses/{houseId}": { request: undefined; response: House };
  "GET /houses/{houseId}/rooms": { request: undefined; response: Room[] };
  "GET /houses/{houseId}/devices": { request: undefined; response: Device[] };
  "GET /devices/{deviceId}": { request: undefined; response: Device };
  "GET /devices/{deviceId}/state": { request: undefined; response: DeviceState };
  "POST /devices/{deviceId}/commands": { request: DeviceCommandRequest; response: DeviceCommand };
  "GET /houses/{houseId}/dashboard": { request: undefined; response: DashboardResponse };
  "GET /houses/{houseId}/events": { request: undefined; response: MessageEvent };
}

export interface DeviceStateChangedEvent {
  type: "device.state.changed";
  houseId: string;
  deviceId: DeviceId;
  state: DeviceState;
  occurredAt: string;
}

export interface DeviceCommandUpdatedEvent {
  type: "device.command.updated";
  houseId: string;
  deviceId: DeviceId;
  command: DeviceCommand;
  occurredAt: string;
}

export type SmartEstateEvent = DeviceStateChangedEvent | DeviceCommandUpdatedEvent;
