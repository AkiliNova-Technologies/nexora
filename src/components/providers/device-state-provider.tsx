"use client";

import * as React from "react";
import { mockDevices, mockDeviceStates, mockHouses, mockRooms, mockSecurityEvents, mockSecurityMode, mockSecuritySensorPolicies } from "@/data/mock-smart-estate";
import type { House, HouseSecurityMode, Room, SecurityEvent, SecurityMode, SecuritySensorPolicy } from "@/domain/smart-estate";
import type { DashboardResponse, LoginRequest, RegisterRequest, SmartEstateEvent, UserResponse } from "@/lib/api/contracts";
import { ApiError, smartEstateApi, smartEstateMode } from "@/lib/api/client";
import { DeviceStore } from "@/lib/device-store";
import { reconcileSecurityEvents, replaceSecurityEvents } from "@/lib/security-event-store";
import { emptySecurityModeState, beginSecurityModeLoad, completeSecurityModeLoad, reconcileSecurityMode } from "@/lib/security-mode-store";
import { emptyPolicyState,beginPolicyLoad,completePolicyLoad,reconcilePolicyList } from "@/lib/security-sensor-policy-store";

type SessionStatus = "loading" | "authenticated" | "anonymous";
interface SmartEstateContextValue {
  mode: "MOCK" | "BACKEND" | "CLOUD"; status: SessionStatus; user: UserResponse | null;
  houses: House[]; currentHouse: House | null; rooms: Room[]; dashboard: DashboardResponse | null;
  securityEvents: SecurityEvent[]; securityEventsLoading:boolean; securityEventsError:string|null;
  securityMode: HouseSecurityMode | null; securityModeLoading:boolean; securityModePending:boolean; securityModeError:string|null;
  securitySensorPolicies:SecuritySensorPolicy[];securitySensorPoliciesLoading:boolean;securitySensorPolicyPendingId:string|null;securitySensorPolicyError:string|null;
  eventStatus: "idle" | "connecting" | "live" | "reconnecting"; error: string | null;
  login(request: LoginRequest): Promise<void>; register(request: RegisterRequest): Promise<void>;
  logout(): Promise<void>; selectHouse(id: string): void; onboardDemoHouse(): Promise<void>; refresh(): Promise<void>; changeSecurityMode(mode:SecurityMode):Promise<void>;changeSecuritySensorPolicy(deviceId:string,change:Pick<SecuritySensorPolicy,"enabled"|"monitorArmedHome"|"monitorArmedAway">):Promise<void>;
}

const DeviceStoreContext = React.createContext<DeviceStore | null>(null);
const SmartEstateContext = React.createContext<SmartEstateContextValue | null>(null);
const mockUser: UserResponse = { id: "mock-user", name: "Demo Resident", email: "demo@nexora.local", role: "USER" };

export function DeviceStateProvider({ children }: { children: React.ReactNode }) {
  const [store] = React.useState(() => new DeviceStore(mockDevices, mockDeviceStates));
  const [status, setStatus] = React.useState<SessionStatus>(smartEstateMode === "MOCK" ? "authenticated" : "loading");
  const [user, setUser] = React.useState<UserResponse | null>(smartEstateMode === "MOCK" ? mockUser : null);
  const [houses, setHouses] = React.useState<House[]>(smartEstateMode === "MOCK" ? mockHouses : []);
  const [currentHouse, setCurrentHouse] = React.useState<House | null>(smartEstateMode === "MOCK" ? mockHouses[0] : null);
  const currentHouseId = currentHouse?.id;
  const [rooms, setRooms] = React.useState<Room[]>(smartEstateMode === "MOCK" ? mockRooms : []);
  const [dashboard, setDashboard] = React.useState<DashboardResponse | null>(null);
  const [eventStatus, setEventStatus] = React.useState<SmartEstateContextValue["eventStatus"]>("idle");
  const [error, setError] = React.useState<string | null>(null);
  const [securityEvents,setSecurityEvents]=React.useState<SecurityEvent[]>(smartEstateMode==="MOCK"?mockSecurityEvents:[]);
  const [securityEventsLoading,setSecurityEventsLoading]=React.useState(false);
  const [securityEventsError,setSecurityEventsError]=React.useState<string|null>(null);
  const [securityModeState,setSecurityModeState]=React.useState(smartEstateMode==="MOCK"?{houseId:mockSecurityMode.houseId,value:mockSecurityMode,loading:false,requestId:0}:emptySecurityModeState);
  const [securityModePending,setSecurityModePending]=React.useState(false);
  const [securityModeError,setSecurityModeError]=React.useState<string|null>(null);
  const [policyState,setPolicyState]=React.useState(smartEstateMode==="MOCK"?{houseId:mockHouses[0].id,policies:mockSecuritySensorPolicies,loading:false,requestId:0}:emptyPolicyState);
  const [securitySensorPolicyPendingId,setSecuritySensorPolicyPendingId]=React.useState<string|null>(null);const [securitySensorPolicyError,setSecuritySensorPolicyError]=React.useState<string|null>(null);
  const requestSequence=React.useRef(0);

  const loadHouse = React.useCallback(async (house: House) => {
    const requestId=++requestSequence.current;
    setCurrentHouse(house); setError(null);
    setSecurityModeState(current=>beginSecurityModeLoad(current,house.id,requestId));setSecurityModeError(null);
    setPolicyState(current=>beginPolicyLoad(current,house.id,requestId));setSecuritySensorPolicyError(null);
    setSecurityEventsLoading(true);setSecurityEventsError(null);setSecurityEvents([]);
    const [nextRooms, devices, nextDashboard,history,nextSecurityMode,nextPolicies] = await Promise.all([
      smartEstateApi.rooms(house.id), smartEstateApi.devices(house.id), smartEstateApi.dashboard(house.id),smartEstateApi.securityEvents(house.id).catch((cause)=>{setSecurityEventsError(cause instanceof Error?cause.message:"Unable to load security activity");return [];}),smartEstateApi.securityMode(house.id),smartEstateApi.securitySensorPolicies(house.id),
    ]);
    if(requestSequence.current!==requestId)return;
    const states = await Promise.all(devices.map((device) => smartEstateApi.state(device.id)));
    setRooms(nextRooms); setDashboard(nextDashboard); store.replaceInventory(devices, states);setSecurityEvents(replaceSecurityEvents(history,house.id,new Set(devices.map(device=>device.id))));setSecurityEventsLoading(false);setSecurityModeState(current=>completeSecurityModeLoad(current,nextSecurityMode,house.id,requestId));setPolicyState(current=>completePolicyLoad(current,nextPolicies,house.id,requestId));
  }, [store]);

  const loadAccount = React.useCallback(async () => {
    const [nextUser, nextHouses] = await Promise.all([smartEstateApi.me(), smartEstateApi.houses()]);
    setUser(nextUser); setHouses(nextHouses); setStatus("authenticated");
    if (nextHouses[0]) await loadHouse(nextHouses[0]);
    else { setCurrentHouse(null); setRooms([]); setDashboard(null);setSecurityModeState(emptySecurityModeState);setPolicyState(emptyPolicyState); store.replaceInventory([], []); }
  }, [loadHouse, store]);

  React.useEffect(() => {
    if (smartEstateMode === "MOCK") return;
    store.setCommandSender((deviceId, type, value, clientRequestId) => smartEstateApi.command(deviceId, {
      command: type, parameters: value === undefined ? undefined : { value }, clientRequestId,
    }));
    // Session recovery is the external synchronization performed by this effect.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAccount().catch((cause) => {
      setStatus("anonymous");
      if (!(cause instanceof ApiError && cause.status === 401)) setError(cause instanceof Error ? cause.message : "Session recovery failed");
    });
  }, [loadAccount, store]);

  React.useEffect(() => {
    if (smartEstateMode !== "BACKEND" || !currentHouse || status !== "authenticated") return;
    let active = true;
    const source = new EventSource(smartEstateApi.eventUrl(currentHouse.id), { withCredentials: true });
    const reconcile = (event: MessageEvent<string>) => {
      try {
        const payload = JSON.parse(event.data) as SmartEstateEvent;
        if (payload.type === "device.state.changed") store.reconcileState(payload.state);
        if (payload.type === "device.command.updated") store.reconcileCommand(payload.command);
        if (payload.type === "device.connectivity.changed") store.setConnectivity(payload.deviceId, payload.connectivity);
        if(payload.type==="security.event.created"&&payload.houseId===currentHouse.id)setSecurityEvents(current=>reconcileSecurityEvents(current,payload.event,currentHouse.id,new Set(store.getSnapshot().devices.map(device=>device.id))));
        if(payload.type==="security.mode.changed"&&payload.houseId===currentHouse.id)setSecurityModeState(current=>({...current,value:reconcileSecurityMode(current.value,{houseId:payload.houseId,mode:payload.mode,version:payload.version,updatedAt:payload.updatedAt},currentHouse.id),loading:false}));
        if(payload.type==="security.sensor-policy.changed"&&payload.houseId===currentHouse.id)setPolicyState(current=>({...current,policies:reconcilePolicyList(current.policies,payload.policy,currentHouse.id),loading:false}));
      } catch { setError("Received an invalid live update"); }
    };
    source.addEventListener("device.state.changed", reconcile as EventListener);
    source.addEventListener("device.command.updated", reconcile as EventListener);
    source.addEventListener("device.connectivity.changed", reconcile as EventListener);
    source.addEventListener("security.event.created", reconcile as EventListener);
    source.addEventListener("security.mode.changed", reconcile as EventListener);
    source.addEventListener("security.sensor-policy.changed", reconcile as EventListener);
    source.addEventListener("connected", () => setEventStatus("live"));
    source.addEventListener("heartbeat", () => setEventStatus("live"));
    source.onerror = () => {
      if (!active) return; setEventStatus("reconnecting");
      void loadHouse(currentHouse).catch((cause) => setError(cause instanceof Error ? cause.message : "State recovery failed"));
    };
    return () => { active = false; source.close(); setEventStatus("idle"); };
  }, [currentHouse, loadHouse, status, store]);

  React.useEffect(() => {
    if (smartEstateMode !== "CLOUD" || !currentHouseId || status !== "authenticated") return;
    let active = true;
    const refreshCloudState = async () => {
      try {
        const update = await smartEstateApi.cloudSync(currentHouseId);
        if (active) {
          for (const state of update.states) store.reconcileState(state);
          for (const command of update.commands) store.reconcileCommand(command);
        }
        if (active) setEventStatus("live");
      } catch (cause) { if (active) { setEventStatus("reconnecting"); setError(cause instanceof Error ? cause.message : "Cloud state refresh failed"); } }
    };
    const timer = window.setInterval(() => void refreshCloudState(), 4000);
    void refreshCloudState();
    return () => { active = false; window.clearInterval(timer); setEventStatus("idle"); };
  }, [currentHouseId, status, store]);

  const value = React.useMemo<SmartEstateContextValue>(() => ({
    mode: smartEstateMode, status, user, houses, currentHouse, rooms, dashboard, eventStatus, error,securityEvents,securityEventsLoading,securityEventsError,securityMode:securityModeState.value,securityModeLoading:securityModeState.loading,securityModePending,securityModeError,securitySensorPolicies:policyState.policies,securitySensorPoliciesLoading:policyState.loading,securitySensorPolicyPendingId,securitySensorPolicyError,
    async login(request) { await smartEstateApi.login(request); await loadAccount(); },
    async register(request) { await smartEstateApi.register(request); await loadAccount(); },
    async logout() { if (smartEstateMode !== "MOCK") await smartEstateApi.logout(); setUser(null); setStatus("anonymous"); setHouses([]); setCurrentHouse(null); setRooms([]);setSecurityModeState(emptySecurityModeState);setPolicyState(emptyPolicyState); store.replaceInventory([], []); },
    selectHouse(id) { const house = houses.find((item) => item.id === id); if (house && house.id !== currentHouse?.id) void loadHouse(house).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load house")); },
    async onboardDemoHouse() { await smartEstateApi.onboardDemoHouse(); await loadAccount(); },
    async refresh() { if (smartEstateMode !== "MOCK") await loadAccount(); },
    async changeSecurityMode(nextMode){if(!currentHouse||!securityModeState.value||securityModePending)return;if(smartEstateMode==="MOCK"){setSecurityModeState(current=>({...current,value:current.value?{...current.value,mode:nextMode,version:current.value.version+1,updatedAt:new Date().toISOString()}:null}));return;}const house=currentHouse;const generation=requestSequence.current;setSecurityModePending(true);setSecurityModeError(null);try{const result=await smartEstateApi.updateSecurityMode(house.id,{mode:nextMode,expectedVersion:securityModeState.value.version,clientRequestId:crypto.randomUUID()});if(requestSequence.current===generation&&house.id===result.houseId)setSecurityModeState(current=>({...current,value:reconcileSecurityMode(current.value,result,result.houseId),loading:false}));}catch(cause){if(requestSequence.current===generation)setSecurityModeError(cause instanceof Error?cause.message:"Unable to change security mode");if(cause instanceof ApiError&&cause.status===409&&requestSequence.current===generation)await loadHouse(house);throw cause;}finally{if(requestSequence.current===generation)setSecurityModePending(false);}},
    async changeSecuritySensorPolicy(deviceId,change){const current=policyState.policies.find(item=>item.deviceId===deviceId);if(!currentHouse||!current||securitySensorPolicyPendingId)return;if(smartEstateMode==="MOCK"){setPolicyState(state=>({...state,policies:reconcilePolicyList(state.policies,{...current,...change,version:current.version+1,updatedAt:new Date().toISOString()},current.houseId)}));return;}const house=currentHouse,generation=requestSequence.current;setSecuritySensorPolicyPendingId(deviceId);setSecuritySensorPolicyError(null);try{const result=await smartEstateApi.updateSecuritySensorPolicy(house.id,deviceId,{...change,expectedVersion:current.version,clientRequestId:crypto.randomUUID()});if(generation===requestSequence.current&&result.houseId===house.id)setPolicyState(state=>({...state,policies:reconcilePolicyList(state.policies,result,house.id)}));}catch(cause){if(generation===requestSequence.current)setSecuritySensorPolicyError(cause instanceof Error?cause.message:"Unable to update sensor policy");if(cause instanceof ApiError&&cause.status===409&&generation===requestSequence.current)await loadHouse(house);throw cause;}finally{if(generation===requestSequence.current)setSecuritySensorPolicyPendingId(null);}},
  }), [currentHouse, dashboard, error, eventStatus, houses, loadAccount, loadHouse, policyState, rooms, securityEvents,securityEventsError,securityEventsLoading,securityModeError,securityModePending,securityModeState,securitySensorPolicyError,securitySensorPolicyPendingId,status, store, user]);

  return <SmartEstateContext.Provider value={value}><DeviceStoreContext.Provider value={store}>{children}</DeviceStoreContext.Provider></SmartEstateContext.Provider>;
}

export function useSmartEstate() { const value = React.useContext(SmartEstateContext); if (!value) throw new Error("useSmartEstate must be used inside DeviceStateProvider"); return value; }
export function useDeviceStore() { const store = React.useContext(DeviceStoreContext); if (!store) throw new Error("useDeviceStore must be used inside DeviceStateProvider"); return store; }
export function useDevices() { const store = useDeviceStore(); return React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot); }
