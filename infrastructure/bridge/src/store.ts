import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";
import type { CloudCommand, CloudEvent, ProvisioningRequest } from "./types.js";

export class BridgeStore {
  readonly db: DatabaseSync;
  constructor(path: string, private readonly maxEvents: number) {
    mkdirSync(dirname(path), { recursive: true });
    this.db = new DatabaseSync(path);
    this.db.exec("PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;");
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS outbound_event(
        event_id TEXT PRIMARY KEY, payload TEXT NOT NULL, attempts INTEGER NOT NULL DEFAULT 0,
        next_attempt_at INTEGER NOT NULL, created_at INTEGER NOT NULL, last_error TEXT
      );
      CREATE TABLE IF NOT EXISTS command_delivery(
        command_id TEXT PRIMARY KEY, controller_id TEXT NOT NULL, device_id TEXT NOT NULL,
        command_type TEXT NOT NULL, payload TEXT NOT NULL, expires_at INTEGER NOT NULL,
        state TEXT NOT NULL CHECK(state IN ('CLAIMED','PUBLISHING','PUBLISHED','UNCERTAIN','TERMINAL')),
        dangerous INTEGER NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS security_checkpoint(
        controller_id TEXT NOT NULL, scope_id TEXT NOT NULL, version INTEGER NOT NULL,
        updated_at INTEGER NOT NULL, PRIMARY KEY(controller_id,scope_id)
      );
      CREATE TABLE IF NOT EXISTS controller_boot(
        controller_id TEXT PRIMARY KEY, boot_id TEXT NOT NULL, updated_at INTEGER NOT NULL
      );
      CREATE TABLE IF NOT EXISTS provisioning_delivery(
        command_id TEXT PRIMARY KEY, controller_id TEXT NOT NULL, payload TEXT NOT NULL,
        expires_at INTEGER NOT NULL,state TEXT NOT NULL CHECK(state IN ('CLAIMED','PUBLISHED','TERMINAL')),
        updated_at INTEGER NOT NULL
      );
    `);
  }
  close() { this.db.close(); }
  enqueueEvent(event: CloudEvent) {
    const count = Number((this.db.prepare("SELECT count(*) AS value FROM outbound_event").get() as { value: number }).value);
    if (count >= this.maxEvents) throw new Error("event_queue_full");
    const now = Date.now();
    this.db.prepare("INSERT OR IGNORE INTO outbound_event(event_id,payload,next_attempt_at,created_at) VALUES(?,?,?,?)").run(event.eventId, JSON.stringify(event), now, now);
  }
  pendingEvents(limit = 50): CloudEvent[] {
    return this.db.prepare("SELECT payload FROM outbound_event WHERE next_attempt_at<=? ORDER BY created_at LIMIT ?").all(Date.now(), limit).map((row) => JSON.parse(String((row as { payload: string }).payload)) as CloudEvent);
  }
  acceptEvents(ids: string[]) {
    const remove = this.db.prepare("DELETE FROM outbound_event WHERE event_id=?");
    this.db.exec("BEGIN IMMEDIATE");
    try { for (const id of ids) remove.run(id); this.db.exec("COMMIT"); } catch (error) { this.db.exec("ROLLBACK"); throw error; }
  }
  retryEvents(ids: string[], error: string) {
    const update = this.db.prepare("UPDATE outbound_event SET attempts=attempts+1,next_attempt_at=?,last_error=? WHERE event_id=?");
    const delay = Math.min(300000, 1000 * 2 ** Math.min(8, Number((this.db.prepare("SELECT max(attempts) value FROM outbound_event").get() as { value?: number }).value || 0)));
    for (const id of ids) update.run(Date.now() + delay, error.slice(0, 500), id);
  }
  recordClaim(command: CloudCommand) {
    const dangerous = ["OPEN", "CLOSE", "ACTIVATE_SIREN", "STOP_SIREN"].includes(command.type) ? 1 : 0;
    this.db.prepare("INSERT OR IGNORE INTO command_delivery(command_id,controller_id,device_id,command_type,payload,expires_at,state,dangerous,updated_at) VALUES(?,?,?,?,?,?,?,?,?)")
      .run(command.commandId, command.controllerId, command.deviceId, command.type, JSON.stringify(command), Date.parse(command.expiresAt), "CLAIMED", dangerous, Date.now());
  }
  deliveryState(commandId: string) {
    return this.db.prepare("SELECT state,dangerous,expires_at FROM command_delivery WHERE command_id=?").get(commandId) as { state: string; dangerous: number; expires_at: number } | undefined;
  }
  pendingClaims(limit = 20): CloudCommand[] {
    return this.db.prepare("SELECT payload FROM command_delivery WHERE state='CLAIMED' AND expires_at>? ORDER BY updated_at LIMIT ?").all(Date.now(), limit).map((row) => JSON.parse(String((row as { payload: string }).payload)) as CloudCommand);
  }
  setDeliveryState(commandId: string, state: "PUBLISHING" | "PUBLISHED" | "UNCERTAIN" | "TERMINAL") {
    this.db.prepare("UPDATE command_delivery SET state=?,updated_at=? WHERE command_id=?").run(state, Date.now(), commandId);
  }
  recoverInterrupted() {
    this.db.prepare("UPDATE command_delivery SET state='UNCERTAIN',updated_at=? WHERE state='PUBLISHING'").run(Date.now());
  }
  recordProvisioning(request:ProvisioningRequest){this.db.prepare("INSERT OR IGNORE INTO provisioning_delivery(command_id,controller_id,payload,expires_at,state,updated_at) VALUES(?,?,?,?,?,?)").run(request.commandId,request.controllerId,JSON.stringify(request),Date.parse(request.expiresAt),"CLAIMED",Date.now());}
  pendingProvisioning():ProvisioningRequest[]{return this.db.prepare("SELECT payload FROM provisioning_delivery WHERE state='CLAIMED' AND expires_at>? ORDER BY updated_at LIMIT 10").all(Date.now()).map(row=>JSON.parse(String((row as {payload:string}).payload)) as ProvisioningRequest);}
  provisioningState(commandId:string){return this.db.prepare("SELECT state,expires_at FROM provisioning_delivery WHERE command_id=?").get(commandId) as {state:string;expires_at:number}|undefined;}
  setProvisioningState(commandId:string,state:"PUBLISHED"|"TERMINAL"){this.db.prepare("UPDATE provisioning_delivery SET state=?,updated_at=? WHERE command_id=?").run(state,Date.now(),commandId);}
  checkpoint(controllerId: string, scopeId: string, version: number) {
    this.db.prepare("INSERT INTO security_checkpoint(controller_id,scope_id,version,updated_at) VALUES(?,?,?,?) ON CONFLICT(controller_id,scope_id) DO UPDATE SET version=excluded.version,updated_at=excluded.updated_at WHERE excluded.version>security_checkpoint.version")
      .run(controllerId, scopeId, version, Date.now());
  }
  checkpointVersion(controllerId: string, scopeId: string) {
    return Number((this.db.prepare("SELECT version FROM security_checkpoint WHERE controller_id=? AND scope_id=?").get(controllerId, scopeId) as { version?: number } | undefined)?.version ?? -1);
  }
  observeBoot(controllerId: string, bootId: string) {
    const previous = this.db.prepare("SELECT boot_id FROM controller_boot WHERE controller_id=?").get(controllerId) as { boot_id?: string } | undefined;
    this.db.prepare("INSERT INTO controller_boot(controller_id,boot_id,updated_at) VALUES(?,?,?) ON CONFLICT(controller_id) DO UPDATE SET boot_id=excluded.boot_id,updated_at=excluded.updated_at").run(controllerId, bootId, Date.now());
    return previous?.boot_id !== bootId;
  }
  cleanup(retentionDays: number) {
    this.db.prepare("DELETE FROM command_delivery WHERE state='TERMINAL' AND updated_at<?").run(Date.now() - retentionDays * 86400000);
    this.db.prepare("DELETE FROM provisioning_delivery WHERE (state='TERMINAL' OR expires_at<?) AND updated_at<?").run(Date.now(),Date.now()-retentionDays*86400000);
  }
  status() {
    return {
      queuedEvents: Number((this.db.prepare("SELECT count(*) value FROM outbound_event").get() as { value: number }).value),
      uncertainCommands: Number((this.db.prepare("SELECT count(*) value FROM command_delivery WHERE state='UNCERTAIN'").get() as { value: number }).value),
    };
  }
}
