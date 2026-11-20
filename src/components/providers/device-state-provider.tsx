"use client";

import * as React from "react";
import { mockDevices, mockDeviceStates, mockHouses, mockRooms, mockSecurityEvents, mockSecurityMode, mockSecuritySensorPolicies } from "@/data/mock-smart-estate";
import type { House, HouseSecurityMode, Room, SecurityEvent, SecurityMode, SecuritySensorPolicy } from "@/domain/smart-estate";
import type { DashboardResponse, LoginRequest, RegisterRequest, SmartEstateEvent, UserResponse } from "@/lib/api/contracts";
import { ApiError, smartEstateApi, smartEstateMode } from "@/lib/api/client";
import { DeviceStore } from "@/lib/device-store";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { reconcileSecurityEvents, replaceSecurityEvents } from "@/lib/security-event-store";
import { emptySecurityModeState, beginSecurityModeLoad, completeSecurityModeLoad, reconcileSecurityMode } from "@/lib/security-mode-store";
import { emptyPolicyState,beginPolicyLoad,completePolicyLoad,reconcilePolicyList } from "@/lib/security-sensor-policy-store";
import { cloudSyncDelay } from "@/lib/cloud-sync";

type SessionStatus = "loading" | "authenticated" | "anonymous";
interface SmartEstateContextValue {
  mode: "MOCK" | "BACKEND" | "CLOUD"; status: SessionStatus; user: UserResponse | null;
  houses: House[]; currentHouse: House | null; rooms: Room[]; dashboard: DashboardResponse | null; houseLoading:boolean;
  securityEvents: SecurityEvent[]; securityEventsLoading:boolean; securityEventsError:string|null;
  securityMode: HouseSecurityMode | null; securityModeLoading:boolean; securityModePending:boolean; securityModeError:string|null;
  securitySensorPolicies:SecuritySensorPolicy[];securitySensorPoliciesLoading:boolean;securitySensorPolicyPendingId:string|null;securitySensorPolicyError:string|null;
  eventStatus: "idle" | "connecting" | "live" | "reconnecting"; error: string | null;
  login(request: LoginRequest): Promise<void>; register(request: RegisterRequest): Promise<boolean>;
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
  const [houseLoading,setHouseLoading]=React.useState(smartEstateMode!=="MOCK");
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
  const sessionSequence=React.useRef(0);

  const loadHouse = React.useCallback(async (house: House, account: UserResponse | null) => {
    const requestId=++requestSequence.current;
    setCurrentHouse(house); setError(null);setHouseLoading(true);setEventStatus("connecting");
    setRooms([]);setDashboard(null);store.replaceInventory([],[]);
    setSecurityModeState(current=>beginSecurityModeLoad(current,house.id,requestId));setSecurityModeError(null);
    setPolicyState(current=>beginPolicyLoad(current,house.id,requestId));setSecuritySensorPolicyError(null);
    setSecurityEventsLoading(true);setSecurityEventsError(null);setSecurityEvents([]);
    const isCurrent=()=>requestSequence.current===requestId;
    const roomsPromise=smartEstateApi.rooms(house.id),devicesPromise=smartEstateApi.devices(house.id),dashboardPromise=smartEstateApi.dashboard(house.id);
    const estateDevicesPromise=account?.role==="ESTATE_ADMIN"
      ? smartEstateApi.estates().then(async estates => (await Promise.all(estates.map(estate=>smartEstateApi.estateDevices(estate.id)))).flat())
      : Promise.resolve([]);
    void Promise.all([smartEstateApi.securityEvents(house.id),devicesPromise]).then(([history,devices])=>{if(isCurrent())setSecurityEvents(replaceSecurityEvents(history,house.id,new Set(devices.map(device=>device.id))));}).catch((cause)=>{if(isCurrent())setSecurityEventsError(cause instanceof Error?cause.message:"Unable to load security activity");}).finally(()=>{if(isCurrent())setSecurityEventsLoading(false);});
    void smartEstateApi.securityMode(house.id).then(value=>{if(isCurrent())setSecurityModeState(current=>completeSecurityModeLoad(current,value,house.id,requestId));}).catch((cause)=>{if(isCurrent()){setSecurityModeState(current=>({...current,loading:false}));setSecurityModeError(cause instanceof Error?cause.message:"Unable to load security mode");}});
    void smartEstateApi.securitySensorPolicies(house.id).then(value=>{if(isCurrent())setPolicyState(current=>completePolicyLoad(current,value,house.id,requestId));}).catch((cause)=>{if(isCurrent()){setPolicyState(current=>({...current,loading:false}));setSecuritySensorPolicyError(cause instanceof Error?cause.message:"Unable to load security sensor policies");}});
    try {
      const [nextRooms, houseDevices, nextDashboard, sharedDevices] = await Promise.all([
        roomsPromise,devicesPromise,dashboardPromise,estateDevicesPromise,
      ]);
      if(requestSequence.current!==requestId)return;
      const devices=[...houseDevices,...sharedDevices];
      const states = await Promise.all(devices.map((device) => smartEstateApi.state(device.id)));
      if(requestSequence.current!==requestId)return;
      setRooms(nextRooms); setDashboard(nextDashboard); store.replaceInventory(devices, states);
    } finally { if(requestSequence.current===requestId)setHouseLoading(false); }
  }, [store]);

  const loadAccount = React.useCallback(async () => {
    const [nextUser, nextHouses] = await Promise.all([smartEstateApi.me(), smartEstateApi.houses()]);
    setUser(nextUser); setHouses(nextHouses); setStatus("authenticated");
    if (nextHouses[0]) void loadHouse(nextHouses[0],nextUser).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load house"));
    else { setCurrentHouse(null); setRooms([]); setDashboard(null);setHouseLoading(false);setSecurityModeState(emptySecurityModeState);setPolicyState(emptyPolicyState); store.replaceInventory([], []); }
  }, [loadHouse, store]);

  React.useEffect(() => {
    if (smartEstateMode === "MOCK") return;
    store.setCommandSender((deviceId, type, value, clientRequestId) => smartEstateApi.command(deviceId, {
      command: type, parameters: value === undefined ? undefined : { value }, clientRequestId,
    }));
    // Session recovery is the external synchronization performed by this effect.
    const sequence = sessionSequence.current;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadAccount().catch((cause) => {
      if (sessionSequence.current !== sequence) return;
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
      void loadHouse(currentHouse,user).catch((cause) => setError(cause instanceof Error ? cause.message : "State recovery failed"));
    };
    return () => { active = false; source.close(); setEventStatus("idle"); };
  }, [currentHouse, loadHouse, status, store, user]);

  React.useEffect(() => {
    if (smartEstateMode !== "CLOUD" || !currentHouseId || status !== "authenticated") return;
    let active = true;
    let timer: number | undefined;
    let failures = 0;
    const isDocumentHidden=()=>document.visibilityState==="hidden";
    const refreshCloudState = async () => {
      if (isDocumentHidden()) {
        if (active) timer = window.setTimeout(() => void refreshCloudState(), cloudSyncDelay(failures, true));
        return;
      }
      try {
        const update = await smartEstateApi.cloudSync(currentHouseId);
        if (active) {
          for (const state of update.states) store.reconcileState(state);
          for (const command of update.commands) store.reconcileCommand(command);
        }
        failures = 0;
        if (active) { setEventStatus("live"); setError(null); }
      } catch (cause) { failures += 1; if (active) { setEventStatus("reconnecting"); setError(cause instanceof Error ? cause.message : "Cloud state refresh failed"); } }
      finally { if (active) timer = window.setTimeout(() => void refreshCloudState(), cloudSyncDelay(failures, isDocumentHidden())); }
    };
    const onVisibilityChange=()=>{if(document.visibilityState==="visible"&&active){if(timer!==undefined)window.clearTimeout(timer);void refreshCloudState();}};
    document.addEventListener("visibilitychange",onVisibilityChange);
    void refreshCloudState();
    return () => { active = false; document.removeEventListener("visibilitychange",onVisibilityChange);if (timer !== undefined) window.clearTimeout(timer); setEventStatus("idle"); };
  }, [currentHouseId, status, store]);

  const value = React.useMemo<SmartEstateContextValue>(() => ({
    mode: smartEstateMode, status, user, houses, currentHouse, rooms, dashboard,houseLoading,eventStatus, error,securityEvents,securityEventsLoading,securityEventsError,securityMode:securityModeState.value,securityModeLoading:securityModeState.loading,securityModePending,securityModeError,securitySensorPolicies:policyState.policies,securitySensorPoliciesLoading:policyState.loading,securitySensorPolicyPendingId,securitySensorPolicyError,
    async login(request) {
      sessionSequence.current += 1;
      if (smartEstateMode === "CLOUD") {
        const { error: authError } = await getSupabaseBrowserClient().auth.signInWithPassword(request);
        if (authError) { setStatus("anonymous"); throw new ApiError("Email or password is incorrect", 401, "INVALID_CREDENTIALS"); }
      } else {
        await smartEstateApi.login(request);
      }
      await loadAccount();
    },
    async register(request) {
      if (smartEstateMode === "CLOUD") {
        const { data, error: authError } = await getSupabaseBrowserClient().auth.signUp({
          email: request.email,
          password: request.password,
          options: {
            data: { display_name: request.name.trim() },
            emailRedirectTo: `${window.location.origin}/auth/confirm?next=/dashboard`,
          },
        });
        if (authError) throw new ApiError(authError.message, authError.status ?? 400, "REGISTRATION_FAILED");
        if (!data.session) {
          setUser(null); setStatus("anonymous");
          return true;
        }
        await loadAccount();
        return false;
      }
      const result = await smartEstateApi.register(request);
      if (result.requiresEmailConfirmation) {
        setUser(null); setStatus("anonymous");
        return true;
      }
      await loadAccount();
      return false;
    },
    async logout() { if (smartEstateMode === "CLOUD") { const { error: authError } = await getSupabaseBrowserClient().auth.signOut(); if (authError) throw new ApiError(authError.message, authError.status ?? 400, "LOGOUT_FAILED"); } else if (smartEstateMode !== "MOCK") await smartEstateApi.logout(); setUser(null); setStatus("anonymous"); setHouses([]); setCurrentHouse(null); setRooms([]);setSecurityModeState(emptySecurityModeState);setPolicyState(emptyPolicyState); store.replaceInventory([], []); },
    selectHouse(id) { const house = houses.find((item) => item.id === id); if (house && house.id !== currentHouse?.id) void loadHouse(house,user).catch((cause) => setError(cause instanceof Error ? cause.message : "Unable to load house")); },
    async onboardDemoHouse() { await smartEstateApi.onboardDemoHouse(); await loadAccount(); },
    async refresh() { if (smartEstateMode !== "MOCK") await loadAccount(); },
    async changeSecurityMode(nextMode){if(!currentHouse||!securityModeState.value||securityModePending)return;if(smartEstateMode==="MOCK"){setSecurityModeState(current=>({...current,value:current.value?{...current.value,mode:nextMode,version:current.value.version+1,updatedAt:new Date().toISOString()}:null}));return;}const house=currentHouse;const generation=requestSequence.current;setSecurityModePending(true);setSecurityModeError(null);try{const result=await smartEstateApi.updateSecurityMode(house.id,{mode:nextMode,expectedVersion:securityModeState.value.version,clientRequestId:crypto.randomUUID()});if(requestSequence.current===generation&&house.id===result.houseId)setSecurityModeState(current=>({...current,value:reconcileSecurityMode(current.value,result,result.houseId),loading:false}));}catch(cause){if(requestSequence.current===generation)setSecurityModeError(cause instanceof Error?cause.message:"Unable to change security mode");if(cause instanceof ApiError&&cause.status===409&&requestSequence.current===generation)await loadHouse(house,user);throw cause;}finally{if(requestSequence.current===generation)setSecurityModePending(false);}},
    async changeSecuritySensorPolicy(deviceId,change){const current=policyState.policies.find(item=>item.deviceId===deviceId);if(!currentHouse||!current||securitySensorPolicyPendingId)return;if(smartEstateMode==="MOCK"){setPolicyState(state=>({...state,policies:reconcilePolicyList(state.policies,{...current,...change,version:current.version+1,updatedAt:new Date().toISOString()},current.houseId)}));return;}const house=currentHouse,generation=requestSequence.current;setSecuritySensorPolicyPendingId(deviceId);setSecuritySensorPolicyError(null);try{const result=await smartEstateApi.updateSecuritySensorPolicy(house.id,deviceId,{...change,expectedVersion:current.version,clientRequestId:crypto.randomUUID()});if(generation===requestSequence.current&&result.houseId===house.id)setPolicyState(state=>({...state,policies:reconcilePolicyList(state.policies,result,house.id)}));}catch(cause){if(generation===requestSequence.current)setSecuritySensorPolicyError(cause instanceof Error?cause.message:"Unable to update sensor policy");if(cause instanceof ApiError&&cause.status===409&&generation===requestSequence.current)await loadHouse(house,user);throw cause;}finally{if(generation===requestSequence.current)setSecuritySensorPolicyPendingId(null);}},
  }), [currentHouse, dashboard, error, eventStatus, houseLoading,houses, loadAccount, loadHouse, policyState, rooms, securityEvents,securityEventsError,securityEventsLoading,securityModeError,securityModePending,securityModeState,securitySensorPolicyError,securitySensorPolicyPendingId,status, store, user]);

  return <SmartEstateContext.Provider value={value}><DeviceStoreContext.Provider value={store}>{children}</DeviceStoreContext.Provider></SmartEstateContext.Provider>;
}

export function useSmartEstate() { const value = React.useContext(SmartEstateContext); if (!value) throw new Error("useSmartEstate must be used inside DeviceStateProvider"); return value; }
export function useDeviceStore() { const store = React.useContext(DeviceStoreContext); if (!store) throw new Error("useDeviceStore must be used inside DeviceStateProvider"); return store; }
export function useDevices() { const store = useDeviceStore(); return React.useSyncExternalStore(store.subscribe, store.getSnapshot, store.getServerSnapshot); }
