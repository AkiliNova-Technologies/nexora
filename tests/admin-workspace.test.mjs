import test from "node:test";
import assert from "node:assert/strict";
import {readFile} from "node:fs/promises";

const read=path=>readFile(new URL(`../${path}`,import.meta.url),"utf8");

test("estate administrators resolve a workspace without owning a house",async()=>{
  const [provider,guard,repository]=await Promise.all([read("src/components/providers/device-state-provider.tsx"),read("src/components/providers/session-guard.tsx"),read("src/lib/cloud/repository.ts")]);
  assert.match(provider,/Promise\.all\(\[smartEstateApi\.houses\(\),smartEstateApi\.estates\(\)\]\)/);
  assert.match(provider,/authorizedHouses\.map\(item=>smartEstateApi\.devices\(item\.id\)\)/);
  assert.match(guard,/user\?\.role==="ESTATE_ADMIN"&&estates\.length>0/);
  assert.match(repository,/estate_admin a where a\.estate_id=h\.estate_id and a\.user_id=\$\{userId\}::uuid and a\.active/);
});

test("backend failures are not rendered as missing assignments",async()=>{
  const [provider,guard]=await Promise.all([read("src/components/providers/device-state-provider.tsx"),read("src/components/providers/session-guard.tsx")]);
  assert.match(provider,/setStatus\("error"\)/);
  assert.match(guard,/Unable to load your workspace/);
  assert.match(guard,/Your assignments have not been changed/);
});

test("administrator pages and API are protected by active estate grants",async()=>{
  const [layout,route,workspace]=await Promise.all([read("src/app/admin/layout.tsx"),read("src/app/api/v1/[...path]/route.ts"),read("src/components/admin/admin-workspace.tsx")]);
  assert.match(layout,/estate_admin where user_id=\$\{user\.id\}::uuid and active/);
  assert.match(route,/ESTATE_ADMIN_REQUIRED/);
  assert.match(workspace,/controller\.pairingState==="REVOKED"/);
});

test("Wi-Fi setup supports offline guidance without sending an offline cloud request",async()=>{
  const workspace=await read("src/components/admin/admin-workspace.tsx");
  assert.match(workspace,/setOfflineGuide\(true\);if\(controller\.mqttState==="ONLINE"\)run\(\(\)=>smartEstateApi\.openProvisioning/);
  assert.match(workspace,/href="http:\/\/192\.168\.4\.1\//);
  assert.match(workspace,/Router passwords are not sent to Nexora Cloud/);
  assert.doesNotMatch(workspace,/<input[^>]*type="password"/);
});

test("shared big fan remains absent from Alexa inventory",async()=>{
  const service=await read("src/lib/alexa/service.ts");
  assert.match(service,/d\.house_id is not null/);
  assert.doesNotMatch(service,/estate\.bigFan/);
});
