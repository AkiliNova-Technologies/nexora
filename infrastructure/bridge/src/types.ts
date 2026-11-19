export type CloudCommand = {
  commandId: string;
  scopeId: string;
  deviceId: string;
  controllerId: string;
  type: string;
  parameters: Record<string, unknown> | null;
  issuedAt: string;
  expiresAt: string;
};

export type CloudEvent = {
  eventId: string;
  scopeId: string;
  deviceId: string;
  kind: "ack" | "state" | "status" | "event";
  receivedAt: string;
  body: Record<string, unknown>;
};

export type ControllerRegistration = {
  controllerId: string;
  scopes: string[];
  devices: Array<{ deviceId: string; scopeId: string }>;
};

export type SecurityMode = {
  controllerId: string;
  scopeId: string;
  mode: string;
  version: number;
  issuedAt: string;
  expiresAt: string;
};

export type BridgeSync = {
  controllers: ControllerRegistration[];
  securityModes: SecurityMode[];
  revokedControllerIds: string[];
};
