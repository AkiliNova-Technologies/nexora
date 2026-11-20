import {randomUUID} from "node:crypto";
import {getSql} from "@/lib/cloud/db";

export type ProvisioningDelivery={commandId:string;controllerId:string;sequence:number;type:"OPEN_PROVISIONING_WINDOW"|"CLOSE_PROVISIONING_WINDOW";parameters:{durationSeconds:number};issuedAt:string;expiresAt:string;leaseId:string};

export async function leaseProvisioning(gatewayId:string,limit:number):Promise<ProvisioningDelivery[]>{
  const sql=getSql();
  await sql`update smart_estate.controller_provisioning_request set status='EXPIRED',error='Request expired before controller acknowledgement',updated_at=now() where gateway_id=${gatewayId} and status in ('PENDING','CLAIMED','PUBLISHED') and expires_at<=now()`;
  const candidates=await sql`select id from smart_estate.controller_provisioning_request where gateway_id=${gatewayId} and status='PENDING' and expires_at>now() order by sequence for update skip locked limit ${limit}`;
  const deliveries:ProvisioningDelivery[]=[];
  for(const candidate of candidates){
    const leaseId=randomUUID();
    const rows=await sql`update smart_estate.controller_provisioning_request set status='CLAIMED',lease_id=${leaseId}::uuid,lease_expires_at=now()+interval '30 seconds',updated_at=now() where id=${candidate.id} and status='PENDING' returning id,controller_id,sequence,operation,duration_seconds,created_at,expires_at`;
    if(rows[0])deliveries.push({commandId:rows[0].id,controllerId:rows[0].controller_id,sequence:Number(rows[0].sequence),type:rows[0].operation,parameters:{durationSeconds:rows[0].duration_seconds},issuedAt:new Date(rows[0].created_at).toISOString(),expiresAt:new Date(rows[0].expires_at).toISOString(),leaseId});
  }
  return deliveries;
}

export async function confirmProvisioning(gatewayId:string,commandId:string,leaseId:string){
  const sql=getSql();const existing=await sql`select id from smart_estate.controller_provisioning_request where id=${commandId}::uuid and gateway_id=${gatewayId} and status='PUBLISHED' and lease_id=${leaseId}::uuid and expires_at>now()`;if(existing[0])return true;
  const rows=await sql`update smart_estate.controller_provisioning_request set status='PUBLISHED',published_at=now(),updated_at=now() where id=${commandId}::uuid and gateway_id=${gatewayId} and status='CLAIMED' and lease_id=${leaseId}::uuid and lease_expires_at>now() and expires_at>now() returning id`;
  return Boolean(rows[0]);
}

export async function acknowledgeProvisioning(gatewayId:string,controllerId:string,body:Record<string,unknown>){
  const commandId=typeof body.commandId==="string"?body.commandId:"";const received=String(body.status);const status=received==="ACCEPTED"?"PUBLISHED":received==="EXECUTED"?"SUCCEEDED":"FAILED";
  const sql=getSql();const rows=await sql`update smart_estate.controller_provisioning_request set status=${status},acknowledgement=${sql.json(body)},error=${status==="FAILED"?String(body.error??"Controller rejected provisioning request"):null},acknowledged_at=${status==="PUBLISHED"?null:new Date()},expires_at=case when ${status}='PUBLISHED' then now()+(duration_seconds+120)*interval '1 second' else expires_at end,updated_at=now() where id=${commandId}::uuid and controller_id=${controllerId} and gateway_id=${gatewayId} and status='PUBLISHED' and expires_at>now() returning id`;
  return Boolean(rows[0]);
}
