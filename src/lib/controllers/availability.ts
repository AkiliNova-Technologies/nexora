import type { DeviceConnectivity } from "@/domain/smart-estate";
export const CONTROLLER_HEARTBEAT_INTERVAL_SECONDS=15;
export const CONTROLLER_DEGRADED_AFTER_SECONDS=35;
export const CONTROLLER_OFFLINE_AFTER_SECONDS=50;
export function heartbeatAvailability(lastSeen:string|null,now=Date.now()):DeviceConnectivity{
  if(!lastSeen)return "UNKNOWN";const age=(now-new Date(lastSeen).getTime())/1000;
  if(!Number.isFinite(age)||age<0)return "UNKNOWN";
  if(age>=CONTROLLER_OFFLINE_AFTER_SECONDS)return "OFFLINE";
  if(age>=CONTROLLER_DEGRADED_AFTER_SECONDS)return "DEGRADED";
  return "ONLINE";
}
