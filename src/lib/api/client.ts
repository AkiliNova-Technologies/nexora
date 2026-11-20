import type {
  ApiErrorResponse,
  DashboardResponse,
  DevelopmentOnboardingResponse,
  DeviceCommandRequest,
  LoginRequest,
  RegisterRequest,
  RegisterResponse,
  SecurityModeChangeRequest,
  SecuritySensorPolicyUpdateRequest,
  UserResponse,
  ControllerSummary,
  SecurityEventPage,
  AdminOverviewResponse,
} from "./contracts.ts";
import type { Device, DeviceCommand, DeviceState, Estate, GateResource, House, HouseSecurityMode, Room, SecurityEvent, SecuritySensorPolicy } from "../../domain/smart-estate.ts";

export type SmartEstateMode = "MOCK" | "BACKEND" | "CLOUD";

const configuredMode = process.env.NEXT_PUBLIC_SMART_ESTATE_MODE?.toUpperCase();
export const smartEstateMode: SmartEstateMode = configuredMode === "BACKEND" ? "BACKEND" : configuredMode === "CLOUD" ? "CLOUD" : "MOCK";

export class ApiError extends Error {
  readonly status: number;
  readonly code: string;
  readonly fieldErrors?: Record<string, string>;
  constructor(
    message: string,
    status: number,
    code = "HTTP_ERROR",
    fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.fieldErrors = fieldErrors;
  }
}

export class SmartEstateApiClient {
  readonly baseUrl: string;
  private csrfToken?: string;
  private readonly timeoutMs: number;

  constructor(
    baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL || (smartEstateMode === "CLOUD" ? "/api/v1" : "http://localhost:8080/api/v1"),
    timeoutMs = 30_000,
  ) {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.timeoutMs = timeoutMs;
  }

  register = (body: RegisterRequest) => this.mutate<RegisterResponse>("/auth/register", body);
  login = (body: LoginRequest) => this.mutate<UserResponse>("/auth/login", body);
  logout = () => this.mutate<void>("/auth/logout");
  me = () => this.request<UserResponse>("/me");
  houses = () => this.request<House[]>("/houses");
  estates = () => this.request<Estate[]>("/estates");
  controllers=(estateId:string)=>this.request<ControllerSummary[]>(`/controllers?estateId=${encodeURIComponent(estateId)}`);
  adminOverview=(estateId?:string)=>this.request<AdminOverviewResponse>(`/admin/overview${estateId?`?estateId=${encodeURIComponent(estateId)}`:""}`);
  assignHouseOwner=(houseId:string,ownerId:string)=>this.mutate<{houseId:string;ownerId:string}>(`/admin/houses/${encodeURIComponent(houseId)}/owner`,{ownerId},"PUT");
  initiateControllerPairing=(controllerId:string)=>this.mutate<{pairingId:string;challenge:string;expiresInSeconds:number}>(`/controllers/${encodeURIComponent(controllerId)}/pairing-challenges`);
  revokeController=(controllerId:string)=>this.mutate<{controllerId:string;revoked:true}>(`/controllers/${encodeURIComponent(controllerId)}/revoke`);
  provisioningStatus=(controllerId:string)=>this.request<{controllerId:string;requests:Array<{id:string;sequence:number;operation:string;status:string;expiresAt:string;acknowledgedAt?:string;error?:string;acknowledgement?:Record<string,unknown>}>}>(`/controllers/${encodeURIComponent(controllerId)}/provisioning`);
  openProvisioning=(controllerId:string,durationSeconds:number)=>this.mutate(`/controllers/${encodeURIComponent(controllerId)}/provisioning`,{durationSeconds});
  cancelProvisioning=(controllerId:string)=>this.mutate(`/controllers/${encodeURIComponent(controllerId)}/provisioning/cancel`);
  gate = (estateId: string) => this.request<GateResource>(`/estates/${estateId}/gate`);
  estateDevices = (estateId: string) => this.request<Device[]>(`/estates/${estateId}/devices`);
  rooms = (houseId: string) => this.request<Room[]>(`/houses/${houseId}/rooms`);
  devices = (houseId: string) => this.request<Device[]>(`/houses/${houseId}/devices`);
  state = (deviceId: string) => this.request<DeviceState>(`/devices/${deviceId}/state`);
  dashboard = (houseId: string) => this.request<DashboardResponse>(`/houses/${houseId}/dashboard`);
  securityEvents = (houseId: string) => this.request<SecurityEvent[]>(`/houses/${houseId}/security-events?limit=5`);
  securityEventPage = (houseId:string,page=0,pageSize=20) => this.request<SecurityEventPage>(`/houses/${houseId}/security-events/page?page=${page}&pageSize=${pageSize}`);
  securityMode = (houseId: string) => this.request<HouseSecurityMode>(`/houses/${houseId}/security-mode`);
  updateSecurityMode = (houseId: string, body: SecurityModeChangeRequest) => this.mutate<HouseSecurityMode>(`/houses/${houseId}/security-mode`, body, "PUT");
  securitySensorPolicies = (houseId:string) => this.request<SecuritySensorPolicy[]>(`/houses/${houseId}/security-sensor-policies`);
  updateSecuritySensorPolicy = (houseId:string,deviceId:string,body:SecuritySensorPolicyUpdateRequest) => this.mutate<SecuritySensorPolicy>(`/houses/${houseId}/security-sensor-policies/${deviceId}`,body,"PUT");
  command = (deviceId: string, body: DeviceCommandRequest) =>
    this.mutate<DeviceCommand>(`/devices/${deviceId}/commands`, body);
  commandStatus = (commandId: string) => this.request<DeviceCommand>(`/device-commands/${commandId}`);
  cloudSync = (houseId: string) => this.request<{ states: DeviceState[]; commands: DeviceCommand[] }>(`/houses/${houseId}/sync`);
  onboardDemoHouse = () => this.mutate<DevelopmentOnboardingResponse>("/dev/onboarding/demo-house");

  eventUrl(houseId: string) {
    return `${this.baseUrl}/houses/${houseId}/events`;
  }
  estateEventUrl(estateId: string) { return `${this.baseUrl}/estates/${estateId}/events`; }

  private async mutate<T>(path: string, body?: unknown, method = "POST"): Promise<T> {
    const send = async () => {
      await this.ensureCsrf();
      return this.request<T>(path, {
        method,
        headers: this.csrfToken ? { "X-XSRF-TOKEN": this.csrfToken } : undefined,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
    };
    try {
      return await send();
    } catch (error) {
      if (!(error instanceof ApiError && error.status === 403 && error.code === "CSRF_INVALID")) throw error;
      this.csrfToken = undefined;
      return send();
    }
  }

  private async ensureCsrf() {
    if (this.csrfToken) return;
    const response = await this.raw("/csrf");
    const payload = (await response.json()) as { token: string };
    this.csrfToken = payload.token;
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.raw(path, init);
    if (response.status === 204 || response.headers.get("content-length") === "0") return undefined as T;
    return response.json() as Promise<T>;
  }

  private async raw(path: string, init: RequestInit = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        credentials: "include",
        signal: controller.signal,
        headers: { Accept: "application/json", "Content-Type": "application/json", ...init.headers },
      });
      if (!response.ok) {
        let error: ApiErrorResponse | undefined;
        try { error = (await response.json()) as ApiErrorResponse; } catch { /* empty/non-JSON response */ }
        throw new ApiError(error?.message || `Request failed (${response.status})`, response.status, error?.code, error?.fieldErrors);
      }
      return response;
    } catch (error) {
      if (error instanceof ApiError) throw error;
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new ApiError("The backend did not respond in time", 0, "REQUEST_TIMEOUT");
      }
      throw new ApiError("Unable to reach the Smart Estate backend", 0, "NETWORK_ERROR");
    } finally {
      clearTimeout(timeout);
    }
  }
}

export const smartEstateApi = new SmartEstateApiClient();
