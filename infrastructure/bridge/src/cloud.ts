import type { BridgeSync, CloudCommand, CloudEvent } from "./types.js";

export class CloudClient {
  constructor(private readonly baseUrl: string, private readonly gatewayId: string, private readonly credential: string) {}
  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
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
  }
  async claimCommands(limit = 20) {
    const result = await this.request<{ commands: CloudCommand[] }>(`/api/iot/v1/commands?limit=${limit}`);
    return result.commands;
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
}
