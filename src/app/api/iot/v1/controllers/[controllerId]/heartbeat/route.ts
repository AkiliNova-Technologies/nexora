import { NextResponse, type NextRequest } from "next/server";
import { authenticateGateway } from "@/lib/cloud/security";
import { getSql } from "@/lib/cloud/db";

export const runtime="nodejs";
export const dynamic="force-dynamic";
const states=new Set(["ONLINE","OFFLINE","UNAVAILABLE","DEGRADED","UNKNOWN"]);

export async function POST(request:NextRequest,{params}:{params:Promise<{controllerId:string}>}) {
  const gateway=authenticateGateway(request);
  if(!gateway)return NextResponse.json({code:"UNAUTHORIZED"},{status:401});
  const {controllerId}=await params;
  let body:Record<string,unknown>;
  try{body=await request.json();}catch{return NextResponse.json({code:"INVALID_JSON"},{status:400});}
  const bootId=typeof body.bootId==="string"&&/^[0-9a-f-]{36}$/i.test(body.bootId)?body.bootId:null;
  const sequence=Number(body.sequence),uptimeSeconds=Number(body.uptimeSeconds);
  const networkState=typeof body.networkState==="string"&&states.has(body.networkState)?body.networkState:"UNKNOWN";
  const mqttState=typeof body.mqttState==="string"&&states.has(body.mqttState)?body.mqttState:"UNKNOWN";
  if(!bootId||!Number.isSafeInteger(sequence)||sequence<0||!Number.isSafeInteger(uptimeSeconds)||uptimeSeconds<0)return NextResponse.json({code:"INVALID_HEARTBEAT"},{status:400});
  const sql=getSql();
  const rows=await sql`update smart_estate.controller set firmware_version=${typeof body.firmwareVersion==="string"?body.firmwareVersion:null},boot_id=${bootId}::uuid,heartbeat_sequence=${sequence},wifi_ssid=${typeof body.wifiSsid==="string"?body.wifiSsid.slice(0,128):null},wifi_rssi=${Number.isInteger(Number(body.wifiRssi))?Number(body.wifiRssi):null},network_state=${networkState},mqtt_state=${mqttState},last_heartbeat_at=now(),last_seen_at=now(),updated_at=now() where id=${controllerId} and gateway_id=${gateway.id} and revoked_at is null and registration_state<>'REVOKED' and (boot_id is distinct from ${bootId}::uuid or heartbeat_sequence is null or heartbeat_sequence<${sequence}) returning id,last_seen_at "receivedAt"`;
  if(!rows[0])return NextResponse.json({code:"REJECTED",message:"Unknown, revoked, or stale controller heartbeat"},{status:409});
  return NextResponse.json({controllerId:rows[0].id,receivedAt:rows[0].receivedAt},{headers:{"Cache-Control":"no-store"}});
}
