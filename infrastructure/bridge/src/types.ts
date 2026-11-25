export type CloudCommand = {
  commandId: string;
  leaseId: string;
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
  /** House modes only: whether each security sensor may raise an alarm in this mode. */
  sensors?: { deviceId: string; monitored: boolean }[];
};

export type BridgeSync = {
  controllers: ControllerRegistration[];
  securityModes: SecurityMode[];
  revokedControllerIds: string[];
};

export type ProvisioningRequest = {
  commandId:string;leaseId:string;controllerId:string;sequence:number;
  type:"OPEN_PROVISIONING_WINDOW"|"CLOSE_PROVISIONING_WINDOW"|"SCAN_WIFI"|"SET_WIFI";
  /** SET_WIFI carries {ssid,password}; the password is removed from local storage once published. */
  parameters:Record<string,unknown>;issuedAt:string;expiresAt:string;
};
