import type { SecurityEvent } from "../domain/smart-estate.ts";
export const LIVE_EVENT_LIMIT = 5;
const order = (a: SecurityEvent, b: SecurityEvent) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt) || b.id.localeCompare(a.id);
const valid = (event: SecurityEvent, houseId: string, knownDevices: Set<string>) => event.houseId === houseId && !!event.deviceId && knownDevices.has(event.deviceId);
export function reconcileSecurityEvents(current:SecurityEvent[],incoming:SecurityEvent,houseId:string,knownDevices:Set<string>){if(!valid(incoming,houseId,knownDevices)||current.some((event)=>event.id===incoming.id))return current;return [incoming,...current].sort(order).slice(0,LIVE_EVENT_LIMIT);}
export function replaceSecurityEvents(events:SecurityEvent[],houseId:string,knownDevices:Set<string>){const result:SecurityEvent[]=[];for(const event of events)if(valid(event,houseId,knownDevices)&&!result.some((item)=>item.id===event.id))result.push(event);return result.sort(order).slice(0,LIVE_EVENT_LIMIT);}
