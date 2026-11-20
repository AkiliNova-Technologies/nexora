import type { BridgeSync, CloudCommand, CloudEvent, ProvisioningRequest } from "./types.js";

export class CloudClient {
  constructor(private readonly baseUrl: string, private readonly gatewayId: string, private readonly credential: string) {}
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const started = Date.now();
    try {
      const response = await fetch(`${this.baseUrl}${path}`, {
        ...init,
        signal: AbortSignal.timeout(15000),
        headers: {
          authorization: `Bearer ${this.credential}`,
          "x-iot-gateway-id": this.gatewayId,
          "content-type": "application/json",
          ...init.headers,
        },
      });
      if (!response.ok) throw new Error(`cloud_${response.status}`);
      return await response.json() as T;
    } catch (error) {
      const reason = error instanceof Error ? error.message : "unknown";
      throw new Error(`${init.method ?? "GET"} ${path.split("?")[0]} after ${Date.now() - started}ms: ${reason}`);
    }
  }
  async claimCommands(limit = 20) {
    const result = await this.request<{ commands: CloudCommand[] }>(`/api/iot/v1/commands?limit=${limit}`);
    return result.commands;
  }
  async confirmCommand(commandId: string, leaseId: string) {
    return await this.request<{ confirmed: true }>("/api/iot/v1/commands", { method: "POST", body: JSON.stringify({ commandId, leaseId }) });
  }
  async sendEvents(events: CloudEvent[]) {
    return await this.request<{ acceptedEventIds: string[] }>("/api/iot/v1/events", { method: "POST", body: JSON.stringify({ events }) });
  }
  async heartbeat(controllerId: string, body: Record<string, unknown>) {
    return await this.request(`/api/iot/v1/controllers/${encodeURIComponent(controllerId)}/heartbeat`, { method: "POST", body: JSON.stringify(body) });
  }
  async sync() {
    return await this.request<BridgeSync>("/api/iot/v1/bridge/sync");
  }
  async claimProvisioning(){return (await this.request<{requests:ProvisioningRequest[]}>("/api/iot/v1/provisioning?limit=10")).requests;}
  async confirmProvisioning(commandId:string,leaseId:string){return this.request<{confirmed:true}>("/api/iot/v1/provisioning",{method:"POST",body:JSON.stringify({commandId,leaseId})});}
  async provisioningAck(controllerId:string,body:Record<string,unknown>){return this.request<{accepted:boolean}>(`/api/iot/v1/controllers/${encodeURIComponent(controllerId)}/provisioning-ack`,{method:"POST",body:JSON.stringify(body)});}
}
