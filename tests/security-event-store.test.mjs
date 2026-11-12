import assert from "node:assert/strict";
import test from "node:test";
import { LIVE_EVENT_LIMIT, reconcileSecurityEvents, replaceSecurityEvents } from "../src/lib/security-event-store.ts";

const known=new Set(["dev-living-motion"]);
const event=(id,occurredAt)=>({id,houseId:"house-1",deviceId:"dev-living-motion",type:"MOTION_DETECTED",severity:"INFO",occurredAt});

test("live event preview remains bounded to five newest events",()=>{
 const current=replaceSecurityEvents(Array.from({length:7},(_,index)=>event(String(index),`2026-10-19T12:00:0${index}Z`)),"house-1",known);
 assert.equal(current.length,LIVE_EVENT_LIMIT);assert.deepEqual(current.map(item=>item.id),["6","5","4","3","2"]);
});
test("SSE insertion deduplicates and uses timestamp then identifier ordering",()=>{
 const initial=replaceSecurityEvents([event("a","2026-10-19T12:00:00Z"),event("b","2026-10-19T12:00:00Z")],"house-1",known);
 const inserted=reconcileSecurityEvents(initial,event("c","2026-10-19T12:00:01Z"),"house-1",known);
 assert.deepEqual(inserted.map(item=>item.id),["c","b","a"]);assert.equal(reconcileSecurityEvents(inserted,event("c","2026-10-19T12:00:01Z"),"house-1",known),inserted);
});
test("REST recovery filters unknown devices and caps retained state",()=>{
 const result=replaceSecurityEvents([event("valid","2026-10-19T12:00:00Z"),{...event("unknown","2026-10-19T12:00:01Z"),deviceId:"other"}],"house-1",known);
 assert.deepEqual(result.map(item=>item.id),["valid"]);
});
