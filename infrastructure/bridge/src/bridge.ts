import type { MqttClient } from "mqtt";
import { CloudClient } from "./cloud.js";
import { commandTopic, parseInbound } from "./protocol.js";
import { publishQos1, subscribeQos1 } from "./broker.js";
import { BridgeStore } from "./store.js";
import type { BridgeSync, CloudCommand, ProvisioningRequest } from "./types.js";
import { log } from "./log.js";

export class Bridge {
  private running = false;
  private hasSynced = false;
  private syncState: BridgeSync = { controllers: [], securityModes: [], revokedControllerIds: [] };
  private cloudHealthy = false;
  private brokerHealthy = false;
  private lastLoopAt = 0;
  private backoffMs = 0;
  private eventUpload: Promise<void> | undefined;
  private eventUploadHealthy: boolean | null = null;

  constructor(
    private readonly cloud: CloudClient,
    private readonly mqtt: MqttClient,
    private readonly store: BridgeStore,
    private readonly pollIntervalMs: number,
    private readonly maxBackoffMs: number,
    private readonly maxPayloadBytes: number,
    private readonly retentionDays: number,
  ) {}

  async start() {
    this.running = true;
    this.store.recoverInterrupted();
    this.mqtt.on("connect", () => { this.brokerHealthy = true; void this.onConnect(); });
    this.mqtt.on("close", () => { this.brokerHealthy = false; });
    this.mqtt.on("error", (error) => log("error", "mqtt_error", { error: error.message }));
    this.mqtt.on("message", (topic, payload) => void this.onMessage(topic, payload));
    while (this.running) {
      this.lastLoopAt = Date.now();
      try {
        await this.refreshSync();
        this.store.cleanup(this.retentionDays);
        this.scheduleEventUpload();
        if (this.brokerHealthy) await this.pollCommands();
        // Optional commissioning must not block normal device control.
        if (this.brokerHealthy && process.env.NEXORA_ENABLE_WIFI_PROVISIONING === "true") {
          try {
            await this.pollProvisioning();
          } catch (error) {
            log("warn", "provisioning_poll_failed", { error: error instanceof Error ? error.message : "unknown" });
          }
        }
        this.cloudHealthy = true;
        this.backoffMs = 0;
      } catch (error) {
        this.cloudHealthy = false;
        this.backoffMs = Math.min(this.maxBackoffMs, Math.max(this.pollIntervalMs, this.backoffMs ? this.backoffMs * 2 : this.pollIntervalMs));
        log("warn", "bridge_loop_failed", { error: error instanceof Error ? error.message : "unknown", retryMs: this.backoffMs });
      }
      await new Promise((resolve) => setTimeout(resolve, this.backoffMs || this.pollIntervalMs));
    }
  }

  private async refreshSync() {
    const next = await this.cloud.sync();
    this.syncState = next;
    this.hasSynced = true;
    if (this.brokerHealthy) await this.subscribe();
    for (const mode of next.securityModes) {
      if (Date.parse(mode.expiresAt) <= Date.now() || mode.version <= this.store.checkpointVersion(mode.controllerId, mode.scopeId)) continue;
      await publishQos1(this.mqtt, `smartestate/v1/controllers/${mode.controllerId}/security-mode`, JSON.stringify(mode));
      this.store.checkpoint(mode.controllerId, mode.scopeId, mode.version);
    }
  }

  private async subscribe() {
    const topics = this.syncState.controllers.flatMap((controller) => [
      `smartestate/v1/controllers/${controller.controllerId}/heartbeat`,
      `smartestate/v1/controllers/${controller.controllerId}/provisioning/ack`,
      ...controller.devices.flatMap((device) => ["ack", "state", "status", "event"].map((kind) => `smartestate/v1/${device.scopeId}/${device.deviceId}/${kind}`)),
    ]);
    if (topics.length) await subscribeQos1(this.mqtt, topics);
  }

  private async onConnect() {
    try { await this.subscribe(); } catch (error) { log("error", "mqtt_subscribe_failed", { error: error instanceof Error ? error.message : "unknown" }); }
  }

  private async onMessage(topic: string, payload: Buffer) {
    try {
      const parsed = parseInbound(topic, payload, this.syncState, this.maxPayloadBytes);
      if (parsed.type === "heartbeat") {
        const occurredAt = typeof parsed.body.occurredAt === "string" ? Date.parse(parsed.body.occurredAt) : Number.NaN;
        if (!Number.isFinite(occurredAt) || occurredAt < Date.now() - 35_000 || occurredAt > Date.now() + 300_000) {
          log("warn", "stale_heartbeat_ignored", { controllerId: parsed.controllerId });
          return;
        }
        await this.cloud.heartbeat(parsed.controllerId, parsed.body);
        const bootId = typeof parsed.body.bootId === "string" ? parsed.body.bootId : "";
        if (bootId && this.store.observeBoot(parsed.controllerId, bootId)) {
          for (const mode of this.syncState.securityModes.filter((item) => item.controllerId === parsed.controllerId && Date.parse(item.expiresAt) > Date.now())) {
            await publishQos1(this.mqtt, `smartestate/v1/controllers/${mode.controllerId}/security-mode`, JSON.stringify(mode));
            this.store.checkpoint(mode.controllerId, mode.scopeId, mode.version);
          }
        }
      }
      else if(parsed.type==="provisioningAck"){
        await this.cloud.provisioningAck(parsed.controllerId,parsed.body);
        if(parsed.body.status!=="ACCEPTED")this.store.setProvisioningState(String(parsed.body.commandId),"TERMINAL");
      } else {
        this.store.enqueueEvent(parsed.event);
        if (parsed.event.kind === "ack" && typeof parsed.event.body.commandId === "string" && ["EXECUTED", "FAILED", "TIMEOUT"].includes(String(parsed.event.body.status))) this.store.setDeliveryState(parsed.event.body.commandId, "TERMINAL");
      }
    } catch (error) {
      log("warn", "mqtt_message_rejected", { topic, error: error instanceof Error ? error.message : "unknown" });
    }
  }

  persistBeforeMqttAck(topic: string, payload: Buffer, done: (error: Error | number, code?: number) => void) {
    // Do not discard queued messages before the initial authoritative registry sync.
    if (!this.hasSynced) {
      done(new Error("registry_not_ready"), 128);
      return;
    }
    let parsed: ReturnType<typeof parseInbound>;
    try {
      parsed = parseInbound(topic, payload, this.syncState, this.maxPayloadBytes);
    } catch (error) {
      // Permanently invalid messages cannot become valid through redelivery.
      log("warn", "mqtt_invalid_message_discarded", { topic, error: error instanceof Error ? error.message : "unknown" });
      done(0);
      return;
    }
    try {
      if (parsed.type === "device") this.store.enqueueEvent(parsed.event);
      done(0);
    } catch (error) {
      log("warn", "mqtt_ack_withheld", { topic, error: error instanceof Error ? error.message : "unknown" });
      done(error instanceof Error ? error : new Error("mqtt_persistence_failed"), 128);
    }
  }

  private scheduleEventUpload() {
    if (this.eventUpload) return;
    this.eventUpload = this.flushEvents().catch((error) => {
      this.eventUploadHealthy = false;
      log("warn", "event_upload_failed", { error: error instanceof Error ? error.message : "unknown" });
    }).finally(() => { this.eventUpload = undefined; });
  }

  private async flushEvents() {
    // The cloud processes each event in a separate database transaction.
    const events = this.store.pendingEvents(5);
    if (!events.length) return;
    try {
      const result = await this.cloud.sendEvents(events);
      this.store.acceptEvents(result.acceptedEventIds);
      this.eventUploadHealthy = true;
    } catch (error) {
      this.store.retryEvents(events.map((event) => event.eventId), error instanceof Error ? error.message : "unknown");
      throw error;
    }
  }

  private async pollCommands() {
    for (const command of this.store.pendingClaims()) await this.confirmAndDeliver(command);
    for (const command of await this.cloud.claimCommands()) {
      if (!this.registrationFor(command) || Date.parse(command.expiresAt) <= Date.now()) continue;
      this.store.recordClaim(command);
      await this.confirmAndDeliver(command);
    }
  }

  private async pollProvisioning(){
    for(const request of this.store.pendingProvisioning())await this.deliverProvisioning(request);
    for(const request of await this.cloud.claimProvisioning()){this.store.recordProvisioning(request);await this.deliverProvisioning(request);}
  }
  private async deliverProvisioning(request:ProvisioningRequest){
    if(Date.parse(request.expiresAt)<=Date.now()||!this.syncState.controllers.some(item=>item.controllerId===request.controllerId))return;
    const state=this.store.provisioningState(request.commandId);if(!state||state.state!=="CLAIMED")return;
    await this.cloud.confirmProvisioning(request.commandId,request.leaseId);
    await publishQos1(this.mqtt,`smartestate/v1/controllers/${request.controllerId}/provisioning`,JSON.stringify(request));
    this.store.setProvisioningState(request.commandId,"PUBLISHED");
  }

  private registrationFor(command: CloudCommand) {
    return this.syncState.controllers.find((controller) => controller.controllerId === command.controllerId && controller.devices.some((device) => device.deviceId === command.deviceId && device.scopeId === command.scopeId));
  }

  private async confirmAndDeliver(command: CloudCommand) {
    if (!this.registrationFor(command) || Date.parse(command.expiresAt) <= Date.now()) return;
    const delivery = this.store.deliveryState(command.commandId);
    if (!delivery || delivery.state !== "CLAIMED") return;
    await this.cloud.confirmCommand(command.commandId, command.leaseId);
    this.store.setDeliveryState(command.commandId, "PUBLISHING");
    try {
      await publishQos1(this.mqtt, commandTopic(command), JSON.stringify(command));
      this.store.setDeliveryState(command.commandId, "PUBLISHED");
    } catch (error) {
      this.store.setDeliveryState(command.commandId, "UNCERTAIN");
      log("warn", "command_delivery_uncertain", { commandId: command.commandId, dangerous: Boolean(delivery.dangerous), error: error instanceof Error ? error.message : "unknown" });
    }
  }

  health() { return { live: this.running, ready: this.running && this.cloudHealthy && this.brokerHealthy, cloud: this.cloudHealthy, eventUploadHealthy: this.eventUploadHealthy, broker: this.brokerHealthy, loopAgeMs: Date.now() - this.lastLoopAt, ...this.store.status() }; }
  async stop() {
    this.running = false;
    await new Promise<void>((resolve) => this.mqtt.end(false, {}, () => resolve()));
    await this.eventUpload;
    this.store.close();
  }
}
