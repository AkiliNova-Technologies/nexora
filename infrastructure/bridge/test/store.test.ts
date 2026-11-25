import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { BridgeStore } from "../src/store.js";

test("event queue preserves identity and survives reopen", () => {
  const directory = mkdtempSync(join(tmpdir(), "nexora-bridge-"));
  const path = join(directory, "queue.sqlite");
  const event = { eventId: "controller:boot:1", scopeId: "house-1", deviceId: "light-1", kind: "state" as const, receivedAt: new Date().toISOString(), body: { eventId: "controller:boot:1", reported: { on: true } } };
  const first = new BridgeStore(path, 100);
  first.enqueueEvent(event);
  first.enqueueEvent(event);
  assert.equal(first.pendingEvents().length, 1);
  first.close();
  const second = new BridgeStore(path, 100);
  assert.deepEqual(second.pendingEvents()[0], event);
  second.acceptEvents([event.eventId]);
  assert.equal(second.pendingEvents().length, 0);
  second.close();
  rmSync(directory, { recursive: true });
});

test("interrupted publication becomes uncertain and is not claimable", () => {
  const directory = mkdtempSync(join(tmpdir(), "nexora-bridge-"));
  const store = new BridgeStore(join(directory, "queue.sqlite"), 100);
  const command = { commandId: "11111111-1111-4111-8111-111111111111", leaseId: "22222222-2222-4222-8222-222222222222", controllerId: "controller-1", scopeId: "estate-1", deviceId: "gate-1", type: "OPEN", parameters: {}, issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30_000).toISOString() };
  store.recordClaim(command);
  store.setDeliveryState(command.commandId, "PUBLISHING");
  store.recoverInterrupted();
  const recovered = store.deliveryState(command.commandId);
  assert.equal(recovered?.state, "UNCERTAIN");
  assert.equal(recovered?.dangerous, 1);
  assert.equal(recovered?.expires_at, Date.parse(command.expiresAt));
  store.close();
  rmSync(directory, { recursive: true });
});

test("durable claims survive reopen and retain the lease identity", () => {
  const directory = mkdtempSync(join(tmpdir(), "nexora-bridge-"));
  const path = join(directory, "queue.sqlite");
  const command = { commandId: "11111111-1111-4111-8111-111111111111", leaseId: "22222222-2222-4222-8222-222222222222", controllerId: "controller-1", scopeId: "house-1", deviceId: "light-1", type: "TURN_ON", parameters: {}, issuedAt: new Date().toISOString(), expiresAt: new Date(Date.now() + 30_000).toISOString() };
  const first = new BridgeStore(path, 100);
  first.recordClaim(command);
  first.close();
  const second = new BridgeStore(path, 100);
  assert.deepEqual(second.pendingClaims(), [command]);
  second.close();
  rmSync(directory, { recursive: true });
});

test("event queue fails closed at its configured capacity", () => {
  const directory = mkdtempSync(join(tmpdir(), "nexora-bridge-"));
  const store = new BridgeStore(join(directory, "queue.sqlite"), 1);
  store.enqueueEvent({ eventId: "event-1", scopeId: "house-1", deviceId: "light-1", kind: "state", receivedAt: new Date().toISOString(), body: { eventId: "event-1" } });
  assert.throws(() => store.enqueueEvent({ eventId: "event-2", scopeId: "house-1", deviceId: "light-1", kind: "state", receivedAt: new Date().toISOString(), body: { eventId: "event-2" } }), /event_queue_full/);
  store.close();
  rmSync(directory, { recursive: true });
});

test("provisioning delivery survives bridge restart without changing sequence",()=>{
  const directory=mkdtempSync(join(tmpdir(),"nexora-bridge-"));const path=join(directory,"queue.sqlite");
  const request={commandId:"11111111-1111-4111-8111-111111111111",leaseId:"22222222-2222-4222-8222-222222222222",controllerId:"controller-1",sequence:42,type:"OPEN_PROVISIONING_WINDOW" as const,parameters:{durationSeconds:300},issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60_000).toISOString()};
  const first=new BridgeStore(path,100);first.recordProvisioning(request);first.close();
  const second=new BridgeStore(path,100);assert.deepEqual(second.pendingProvisioning(),[request]);second.setProvisioningState(request.commandId,"PUBLISHED");assert.equal(second.pendingProvisioning().length,0);second.close();rmSync(directory,{recursive:true});
});

test("a Wi-Fi password is removed from the bridge's disk once published",()=>{
  const directory=mkdtempSync(join(tmpdir(),"nexora-bridge-"));const path=join(directory,"queue.sqlite");
  const request={commandId:"33333333-3333-4333-8333-333333333333",leaseId:"44444444-4444-4444-8444-444444444444",controllerId:"controller-1",sequence:43,type:"SET_WIFI" as const,parameters:{ssid:"Estate-Office",password:"correct-horse-battery"},issuedAt:new Date().toISOString(),expiresAt:new Date(Date.now()+60_000).toISOString()};
  const store=new BridgeStore(path,100);store.recordProvisioning(request);
  assert.equal(store.pendingProvisioning()[0].parameters.password,"correct-horse-battery");
  store.setProvisioningState(request.commandId,"PUBLISHED");store.redactProvisioningSecret(request.commandId);store.close();
  for(const file of [path,`${path}-wal`]){
    let raw:Buffer;try{raw=readFileSync(file);}catch{continue;}
    assert.equal(raw.includes(Buffer.from("correct-horse-battery")),false,`password bytes must not remain in ${file}`);
  }
  rmSync(directory,{recursive:true});
});
