import { readFile } from "node:fs/promises";

const path=process.argv[2];
if(!path)throw new Error("Usage: node scripts/validate-controller-manifest.mjs <manifest.json>");
const manifest=JSON.parse(await readFile(path,"utf8"));
const errors=[];
if(!manifest.controller?.id||manifest.controller.id==="REQUIRED")errors.push("controller.id is unresolved");
if(!manifest.controller?.gatewayId||manifest.controller.gatewayId==="REQUIRED")errors.push("controller.gatewayId is unresolved");
if(!manifest.controller?.hardwareIdentity||manifest.controller.hardwareIdentity==="REQUIRED")errors.push("controller.hardwareIdentity is unresolved");
const names=new Set();
for(const device of manifest.devices??[]){
  if(names.has(device.logicalName))errors.push(`duplicate logicalName: ${device.logicalName}`);names.add(device.logicalName);
  if(device.scope==="house1"&&!manifest.houseMappings?.house1)errors.push(`${device.logicalName}: House 1 mapping unresolved`);
  if(device.scope==="house2"&&!manifest.houseMappings?.house2)errors.push(`${device.logicalName}: omitted until House 2 exists`);
  if(device.logicalName==="house1.fan"&&device.scope!=="house1")errors.push("fan must be House 1 scoped");
}
console.log(JSON.stringify({mode:"DRY_RUN_ONLY",deviceCount:names.size,valid:errors.length===0,errors},null,2));
process.exitCode=errors.length?1:0;
