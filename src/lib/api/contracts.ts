import type {
  Device,
  DeviceCommand,
  DeviceCommandType,
  DeviceId,
  DeviceState,
  House,
  Room,
  SecurityEvent,
  HouseSecurityMode,
  SecurityMode,
  SecuritySensorPolicy,
  Estate,
  GateResource,
} from "../../domain/smart-estate.ts";

export const API_PREFIX = "/api/v1" as const;

export interface ApiErrorResponse {
  code: string;
  message: string;
  fieldErrors?: Record<string, string>;
}

export interface RegisterRequest {
  name: string;
  email: string;
  password: string;
}
export interface LoginRequest {
  email: string;
  password: string;
}
export interface UserResponse {
  id: string;
  name: string;
  email: string;
  role: "USER" | "ESTATE_ADMIN";
}
export interface RegisterResponse extends UserResponse {
  requiresEmailConfirmation?: boolean;
}

export interface DeviceCommandRequest {
  command: DeviceCommandType;
  parameters?: { value?: number; durationSeconds?: number; r?: number; g?: number; b?: number };
  clientRequestId: string;
}
export interface SecurityModeChangeRequest {
  mode: SecurityMode;
  expectedVersion: number;
  clientRequestId: string;
}
export interface SecuritySensorPolicyUpdateRequest {
  enabled: boolean;
  monitorArmedHome: boolean;
  monitorArmedAway: boolean;
  expectedVersion: number;
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
export interface SecurityEventPage { items: SecurityEvent[]; page: number; pageSize: number; total: number; totalPages: number; }
export interface ControllerSummary {id:string;estateId:string;gatewayId:string;name:string;hardwareIdentity:string;registrationState:"PENDING"|"PAIRED"|"REVOKED";pairingState:"UNPAIRED"|"CHALLENGE_ISSUED"|"PAIRED"|"REVOKED";firmwareVersion?:string|null;credentialVersion:number;revokedAt?:string|null;wifiSsid?:string|null;wifiRssi?:number|null;networkState:DeviceState["connectivity"];mqttState:DeviceState["connectivity"];availability:DeviceState["connectivity"];lastHeartbeatAt?:string|null;lastSeenAt?:string|null;}

export interface DevelopmentOnboardingResponse {
  houseId: string;
  sourceHouseId: string;
  rooms: number;
  devices: number;
}

export interface ApiContract {
  "POST /auth/register": { request: RegisterRequest; response: RegisterResponse };
  "POST /auth/login": { request: LoginRequest; response: UserResponse };
  "POST /auth/logout": { request: undefined; response: undefined };
  "GET /me": { request: undefined; response: UserResponse };
  "GET /houses": { request: undefined; response: House[] };
  "GET /estates": { request: undefined; response: Estate[] };
  "GET /estates/{estateId}/gate": { request: undefined; response: GateResource };
  "GET /houses/{houseId}": { request: undefined; response: House };
  "GET /houses/{houseId}/rooms": { request: undefined; response: Room[] };
  "GET /houses/{houseId}/devices": { request: undefined; response: Device[] };
  "GET /devices/{deviceId}": { request: undefined; response: Device };
  "GET /devices/{deviceId}/state": {
    request: undefined;
    response: DeviceState;
  };
  "POST /devices/{deviceId}/commands": {
    request: DeviceCommandRequest;
    response: DeviceCommand;
  };
  "GET /device-commands/{commandId}": {
    request: undefined;
    response: DeviceCommand;
  };
  "POST /dev/onboarding/demo-house": {
    request: undefined;
    response: DevelopmentOnboardingResponse;
  };
  "GET /houses/{houseId}/dashboard": {
    request: undefined;
    response: DashboardResponse;
  };
  "GET /houses/{houseId}/security-mode": {
    request: undefined;
    response: HouseSecurityMode;
  };
  "PUT /houses/{houseId}/security-mode": {
    request: SecurityModeChangeRequest;
    response: HouseSecurityMode;
  };
  "GET /houses/{houseId}/security-sensor-policies": {
    request: undefined;
    response: SecuritySensorPolicy[];
  };
  "PUT /houses/{houseId}/security-sensor-policies/{deviceId}": {
    request: SecuritySensorPolicyUpdateRequest;
    response: SecuritySensorPolicy;
  };
  "GET /houses/{houseId}/events": {
    request: undefined;
    response: MessageEvent;
  };
  "GET /houses/{houseId}/security-events/page": { request: undefined; response: SecurityEventPage };
}

export interface DeviceStateChangedEvent {
  type: "device.state.changed";
  houseId?: string;
  estateId?: string;
  deviceId: DeviceId;
  state: DeviceState;
  occurredAt: string;
}

export interface DeviceCommandUpdatedEvent {
  type: "device.command.updated";
  houseId?: string;
  estateId?: string;
  deviceId: DeviceId;
  command: DeviceCommand;
  occurredAt: string;
}

export interface DeviceConnectivityChangedEvent {
  type: "device.connectivity.changed";
  houseId?: string;
  estateId?: string;
  deviceId: DeviceId;
  connectivity: "ONLINE" | "OFFLINE";
  occurredAt: string;
}
export interface SecurityEventCreatedEvent {
  type: "security.event.created";
  houseId: string;
  deviceId: DeviceId;
  event: SecurityEvent;
  occurredAt: string;
}
export interface SecurityModeChangedEvent {
  type: "security.mode.changed";
  houseId: string;
  mode: SecurityMode;
  version: number;
  updatedAt: string;
}
export interface SecuritySensorPolicyChangedEvent {
  type: "security.sensor-policy.changed";
  houseId: string;
  deviceId: DeviceId;
  policy: SecuritySensorPolicy;
  version: number;
  updatedAt: string;
}

export type SmartEstateEvent =
  | DeviceStateChangedEvent
  | DeviceCommandUpdatedEvent
  | DeviceConnectivityChangedEvent
  | SecurityEventCreatedEvent
  | SecurityModeChangedEvent
  | SecuritySensorPolicyChangedEvent;
