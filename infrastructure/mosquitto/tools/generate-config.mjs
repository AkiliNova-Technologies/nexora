import { readFileSync, writeFileSync, chmodSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const [registryPath, credentialsPath, outputDir] = process.argv.slice(2);
if (!registryPath || !credentialsPath || !outputDir) throw new Error("Usage: generate-config.mjs REGISTRY CREDENTIALS OUTPUT_DIR");
const registry = JSON.parse(readFileSync(registryPath, "utf8"));
const credentials = JSON.parse(readFileSync(credentialsPath, "utf8"));
if (!Array.isArray(registry.controllers) || !Array.isArray(credentials.users)) throw new Error("Invalid registry or credentials document");
const id = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const passwordFile = join(outputDir, "passwords");
writeFileSync(passwordFile, "", { mode: 0o600 });
const users = new Map(credentials.users.map((user) => [user.username, user.password]));
const acl = [];
for (const controller of registry.controllers) {
  if (!id.test(controller.controllerId) || !id.test(controller.username) || !Array.isArray(controller.devices)) throw new Error("Invalid controller registry entry");
  const password = users.get(controller.username);
  if (typeof password !== "string" || password.length < 32) throw new Error(`Missing high-entropy credential for ${controller.username}`);
  execFileSync("mosquitto_passwd", ["-b", passwordFile, controller.username, password], { stdio: "ignore" });
  acl.push(
    `user ${controller.username}`,
    `topic write smartestate/v1/controllers/${controller.controllerId}/heartbeat`,
    `topic read smartestate/v1/controllers/${controller.controllerId}/security-mode`,
    `topic read smartestate/v1/controllers/${controller.controllerId}/provisioning`,
    `topic write smartestate/v1/controllers/${controller.controllerId}/provisioning/ack`,
  );
  for (const device of controller.devices) {
    if (!id.test(device.deviceId) || !id.test(device.scopeId)) throw new Error("Invalid device registry entry");
    const prefix = `smartestate/v1/${device.scopeId}/${device.deviceId}`;
    acl.push(`topic read ${prefix}/command`, `topic write ${prefix}/ack`, `topic write ${prefix}/state`, `topic write ${prefix}/status`, `topic write ${prefix}/event`);
  }
  acl.push("");
}
const bridge = registry.bridge;
if (!bridge || !id.test(bridge.username)) throw new Error("Bridge registry entry is required");
const bridgePassword = users.get(bridge.username);
if (typeof bridgePassword !== "string" || bridgePassword.length < 32) throw new Error("Missing high-entropy bridge credential");
execFileSync("mosquitto_passwd", ["-b", passwordFile, bridge.username, bridgePassword], { stdio: "ignore" });
acl.push(`user ${bridge.username}`);
for (const controller of registry.controllers) {
  acl.push(
    `topic read smartestate/v1/controllers/${controller.controllerId}/heartbeat`,
    `topic write smartestate/v1/controllers/${controller.controllerId}/security-mode`,
    `topic write smartestate/v1/controllers/${controller.controllerId}/provisioning`,
    `topic read smartestate/v1/controllers/${controller.controllerId}/provisioning/ack`,
  );
  for (const device of controller.devices) {
    const prefix = `smartestate/v1/${device.scopeId}/${device.deviceId}`;
    acl.push(`topic write ${prefix}/command`, `topic read ${prefix}/ack`, `topic read ${prefix}/state`, `topic read ${prefix}/status`, `topic read ${prefix}/event`);
  }
}
writeFileSync(join(outputDir, "acl"), `${acl.join("\n")}\n`, { mode: 0o600 });
chmodSync(passwordFile, 0o600);
