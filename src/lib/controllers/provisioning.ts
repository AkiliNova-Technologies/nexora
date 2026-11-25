import {randomUUID} from "node:crypto";
import {getSql} from "@/lib/cloud/db";
import {decryptWifiPassword, wifiSecretKey} from "./wifi-secret";

export type ProvisioningOperation="OPEN_PROVISIONING_WINDOW"|"CLOSE_PROVISIONING_WINDOW"|"SCAN_WIFI"|"SET_WIFI";
export type ProvisioningDelivery={commandId:string;controllerId:string;sequence:number;type:ProvisioningOperation;parameters:Record<string,unknown>;issuedAt:string;expiresAt:string;leaseId:string};

const wipeSecret="secret_ciphertext=null,secret_nonce=null,secret_tag=null";

/** Parameters sent to the controller. A SET_WIFI password is decrypted only here, at delivery time. */
function deliveryParameters(row:Record<string,unknown>):Record<string,unknown>|null{
  if(row.operation==="SCAN_WIFI")return {};
  if(row.operation==="SET_WIFI"){
    const ssid=typeof (row.parameters as {ssid?:unknown}|null)?.ssid==="string"?(row.parameters as {ssid:string}).ssid:"";
    if(!ssid)return null;
    if(!row.secret_ciphertext)return {ssid,password:""};
    try{return {ssid,password:decryptWifiPassword({ciphertext:String(row.secret_ciphertext),nonce:String(row.secret_nonce),tag:String(row.secret_tag)},String(row.id),wifiSecretKey())};}
    catch{return null;}
  }
  return {durationSeconds:Number(row.duration_seconds)};
}

export async function leaseProvisioning(gatewayId:string,limit:number):Promise<ProvisioningDelivery[]>{
  const sql=getSql();
  await sql.unsafe(`update smart_estate.controller_provisioning_request set status='EXPIRED',error='Request expired before controller acknowledgement',${wipeSecret},updated_at=now() where gateway_id=$1 and status in ('PENDING','CLAIMED','PUBLISHED') and expires_at<=now()`,[gatewayId]);
  const candidates=await sql`select id from smart_estate.controller_provisioning_request where gateway_id=${gatewayId} and status='PENDING' and expires_at>now() order by sequence for update skip locked limit ${limit}`;
  const deliveries:ProvisioningDelivery[]=[];
  for(const candidate of candidates){
    const leaseId=randomUUID();
    const rows=await sql`update smart_estate.controller_provisioning_request set status='CLAIMED',lease_id=${leaseId}::uuid,lease_expires_at=now()+interval '30 seconds',updated_at=now() where id=${candidate.id} and status='PENDING' returning id,controller_id,sequence,operation,parameters,duration_seconds,secret_ciphertext,secret_nonce,secret_tag,created_at,expires_at`;
    if(!rows[0])continue;
    const parameters=deliveryParameters(rows[0]);
    if(!parameters){
      // Undecryptable or malformed: fail it now rather than send something wrong to the controller.
      await sql.unsafe(`update smart_estate.controller_provisioning_request set status='FAILED',error='The network change could not be prepared on the server',${wipeSecret},updated_at=now() where id=$1`,[rows[0].id]);
      continue;
    }
    deliveries.push({commandId:rows[0].id,controllerId:rows[0].controller_id,sequence:Number(rows[0].sequence),type:rows[0].operation,parameters,issuedAt:new Date(rows[0].created_at).toISOString(),expiresAt:new Date(rows[0].expires_at).toISOString(),leaseId});
  }
  return deliveries;
}

export async function confirmProvisioning(gatewayId:string,commandId:string,leaseId:string){
  const sql=getSql();const existing=await sql`select id from smart_estate.controller_provisioning_request where id=${commandId}::uuid and gateway_id=${gatewayId} and status='PUBLISHED' and lease_id=${leaseId}::uuid and expires_at>now()`;if(existing[0])return true;
  // The bridge now holds the delivery, so the server's encrypted copy of any password is wiped.
  const rows=await sql.unsafe(`update smart_estate.controller_provisioning_request set status='PUBLISHED',published_at=now(),${wipeSecret},updated_at=now() where id=$1::uuid and gateway_id=$2 and status='CLAIMED' and lease_id=$3::uuid and lease_expires_at>now() and expires_at>now() returning id`,[commandId,gatewayId,leaseId]);
  return Boolean(rows[0]);
}

export async function acknowledgeProvisioning(gatewayId:string,controllerId:string,body:Record<string,unknown>){
  const commandId=typeof body.commandId==="string"?body.commandId:"";const received=String(body.status);const status=received==="ACCEPTED"?"PUBLISHED":received==="EXECUTED"?"SUCCEEDED":"FAILED";
  // Never store anything password-like that a controller might echo back.
  const acknowledgement={...body};delete (acknowledgement as {password?:unknown}).password;
  const sql=getSql();const rows=await sql`update smart_estate.controller_provisioning_request set status=${status},acknowledgement=${sql.json(acknowledgement as never)},error=${status==="FAILED"?String(body.error??"Controller rejected provisioning request"):null},acknowledged_at=${status==="PUBLISHED"?null:new Date()},expires_at=case when ${status}='PUBLISHED' then now()+(duration_seconds+120)*interval '1 second' else expires_at end,secret_ciphertext=null,secret_nonce=null,secret_tag=null,updated_at=now() where id=${commandId}::uuid and controller_id=${controllerId} and gateway_id=${gatewayId} and status='PUBLISHED' and expires_at>now() returning id`;
  return Boolean(rows[0]);
}
