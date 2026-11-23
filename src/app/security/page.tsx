"use client";

import * as React from "react";
import Link from "next/link";
import {
  AlertTriangle,
  Camera,
  DoorOpen,
  LockKeyhole,
  Radar,
  ShieldCheck,
  Wifi,
  WifiOff,
} from "lucide-react";

import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SectionCards, type MetricCardItem } from "@/components/section-cards";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import type { Device, DeviceState, SecurityMode } from "@/domain/smart-estate";
import { useDeviceStore, useDevices, useSmartEstate } from "@/components/providers/device-state-provider";
import { getCapability } from "@/lib/device-capabilities";

type SecurityStatus = "safe" | "warning" | "alert";
type DeviceStatus = "online" | "offline" | "warning";

const securityDeviceIconMap = {
  CAMERA: Camera,
  LOCK: LockKeyhole,
  MOTION_SENSOR: Radar,
  CONTACT_SENSOR: DoorOpen,
  ULTRASONIC_SENSOR: Radar,
};

const statusStyles = {
  online: "border-green-500/20 bg-green-500/10 text-green-400",
  offline: "border-red-500/20 bg-red-500/10 text-red-400",
  warning: "border-amber-500/20 bg-amber-500/10 text-amber-400",
};

export default function SecurityPage() {
  const {securityMode,securityModeLoading,securityModePending,securityModeError,changeSecurityMode,securityEvents,currentHouse,securitySensorPolicies,securitySensorPoliciesLoading}=useSmartEstate();
  const {devices,states}=useDevices();
  const mode=securityMode?.mode??"DISARMED";
  const systemStatus: SecurityStatus =
    mode === "DISARMED" ? "warning" : "safe";
  const modeLabel=mode==="ARMED_AWAY"?"Armed Away":mode==="ARMED_HOME"?"Armed Home":"Disarmed";
  const sensors=devices.filter(device=>device.houseId===currentHouse?.id&&["MOTION_SENSOR","CONTACT_SENSOR","ULTRASONIC_SENSOR"].includes(device.type));
  const canArmHome=!securitySensorPoliciesLoading&&sensors.some(device=>states[device.id]?.connectivity==="ONLINE"&&securitySensorPolicies.some(policy=>policy.deviceId===device.id&&policy.enabled&&policy.monitorArmedHome));
  const canArmAway=!securitySensorPoliciesLoading&&sensors.some(device=>states[device.id]?.connectivity==="ONLINE"&&securitySensorPolicies.some(policy=>policy.deviceId===device.id&&policy.enabled&&policy.monitorArmedAway));
  const metrics:MetricCardItem[]=[
    {title:"Security Mode",value:securityModeLoading?"Loading…":securityMode?modeLabel:"Unknown",icon:ShieldCheck,tone:securityMode?"green":"neutral",footerText:securityMode?"Backend-authoritative security mode.":"Security configuration is unavailable."},
    {title:"Registered Sensors",value:sensors.length,icon:Radar,tone:"blue",footerText:"Security sensors assigned to this house."},
    {title:"Recorded Events",value:securityEvents.length,icon:AlertTriangle,tone:"amber",footerText:"Recent events returned by the backend."},
    {title:"Offline Sensors",value:sensors.filter(device=>states[device.id]?.connectivity==="OFFLINE").length,icon:WifiOff,tone:"red",footerText:"Sensors without confirmed connectivity."},
  ];

  return (
    <SidebarProvider
      style={
        {
          "--sidebar-width": "calc(var(--spacing) * 72)",
          "--header-height": "calc(var(--spacing) * 14)",
        } as React.CSSProperties
      }
    >
      <AppSidebar variant="inset" />

      <SidebarInset className="bg-transparent">
        <SiteHeader />

        <main className="flex flex-1 flex-col">
          <div className="mx-auto flex w-full flex-col gap-6 px-4 py-5 md:px-6 md:py-7">
            <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Home protection center
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
                  Security
                </h1>
              </div>

            </section>

            <SectionCards items={metrics} />

            <section className="grid gap-5">
              <SecurityStatusPanel mode={mode} available={Boolean(securityMode)} status={systemStatus} loading={securityModeLoading} pending={securityModePending} error={securityModeError} onChange={changeSecurityMode} canArmHome={canArmHome} canArmAway={canArmAway} />
            </section>

            <section className="grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <SecurityDeviceGrid />
              <SecurityEventsFeed />
            </section>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function SecurityStatusPanel({
  mode,
  status, available,
  loading,pending,error,onChange,canArmHome,canArmAway,
}: {
  mode: SecurityMode;
  status: SecurityStatus; available:boolean;
  loading:boolean;pending:boolean;error:string|null;onChange:(mode:SecurityMode)=>Promise<void>;canArmHome:boolean;canArmAway:boolean;
}) {
  const labels:Record<SecurityMode,string>={DISARMED:"Disarmed",ARMED_HOME:"Armed Home",ARMED_AWAY:"Armed Away"};
  return (
    <section className="overflow-hidden rounded-[2rem] border border-green-500/20 bg-card/80 p-6 shadow-2xl shadow-black/30 backdrop-blur">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex gap-4">
          <div
            className={cn(
              "flex size-16 shrink-0 items-center justify-center rounded-3xl border",
              status === "safe" && "border-green-500/20 bg-green-500/10 text-green-400",
              status === "warning" && "border-amber-500/20 bg-amber-500/10 text-amber-400",
              status === "alert" && "border-red-500/20 bg-red-500/10 text-red-400"
            )}
          >
            <ShieldCheck className="size-8" />
          </div>

          <div>
            <Badge
              variant="outline"
              className={cn(
                "mb-3 rounded-full",
                status === "safe" && "border-green-500/20 bg-green-500/10 text-green-400",
                status === "warning" && "border-amber-500/20 bg-amber-500/10 text-amber-400",
                status === "alert" && "border-red-500/20 bg-red-500/10 text-red-400"
              )}
            >
              <span className="mr-1.5 size-1.5 rounded-full bg-current" />
              System {status}
            </Badge>

            <h2 className="text-2xl font-semibold text-white">
              Security system is {loading?"loading":available?labels[mode]:"unavailable"}
            </h2>

            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {loading ? "Loading security configuration." : mode === "DISARMED" ? "Sensors may record activity, but intrusion alerts are not armed." : "Configured security sensors participate according to their backend policies."}
            </p>
          </div>
        </div>

      </div>

        <div className="grid grid-cols-3 gap-2 rounded-3xl border border-white/10 bg-white/[0.03] p-2 mt-8">
          {(["ARMED_AWAY", "ARMED_HOME", "DISARMED"] as SecurityMode[]).map((item) => (
            <Button
              key={item}
              variant="outline"
              onClick={() => void onChange(item).catch(()=>undefined)}
              disabled={loading||pending||!available||(item==="ARMED_HOME"&&!canArmHome)||(item==="ARMED_AWAY"&&!canArmAway)}
              className={cn(
                "rounded-2xl border-white/10 bg-transparent text-muted-foreground hover:bg-white/10 hover:text-white",
                mode === item && "border-blue-500/20 bg-blue-500/15 text-blue-400"
              )}
            >
              {labels[item]}
            </Button>
          ))}
        </div>
        {pending&&<p className="mt-3 text-sm text-blue-400">Updating security mode…</p>}
        {error&&<p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
        {(!canArmHome||!canArmAway)&&<p role="status" className="mt-3 rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-200">Arming is unavailable until this house has an online, enabled security sensor assigned to it for the selected mode. Perimeter sensors do not count as house sensors.</p>}
        <div className="mt-8 border-t border-white/10 pt-6">
          <h3 id="sensor-policy-heading" className="text-lg font-semibold text-white">Intrusion Monitoring</h3>
          <p className="mt-1 text-sm text-muted-foreground">Choose which motion sensors participate in security monitoring.</p>
          <SecuritySensorPolicies />
        </div>
    </section>
  );
}

function SecurityDeviceGrid() {
  const { devices, states } = useDevices();
  const {rooms,currentHouse}=useSmartEstate();
  const securityDevices = devices.filter((device) =>
    device.houseId===currentHouse?.id&&["CAMERA", "LOCK", "MOTION_SENSOR", "CONTACT_SENSOR","ULTRASONIC_SENSOR"].includes(device.type),
  );
  return (
    <section className="rounded-[2rem] border border-white/10 bg-card/80 p-5 shadow-xl shadow-black/20 backdrop-blur">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-white">Security Devices</h2>
          <p className="text-sm text-muted-foreground">
            Cameras, locks, sensors, and access monitors.
          </p>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {securityDevices.map((device) => (
          <SecurityDeviceCard key={device.id} device={device} state={states[device.id]} roomName={rooms.find(room=>room.id===device.roomId)?.name} />
        ))}
      </div>
    </section>
  );
}

function SecurityDeviceCard({ device, state,roomName }: { device: Device; state: DeviceState;roomName?:string }) {
  const store = useDeviceStore();
  const Icon = securityDeviceIconMap[device.type as keyof typeof securityDeviceIconMap];
  const enabled = device.type === "LOCK" ? state.reported.locked ?? false : state.reported.on ?? true;
  const status: DeviceStatus = state.connectivity === "OFFLINE" ? "offline" : device.type === "MOTION_SENSOR"&&state.reported.motion ? "warning" : "online";
  const canPower = getCapability(device, "POWER") !== undefined;
  const canLock = getCapability(device, "LOCK") !== undefined;

  return (
    <article className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex gap-3">
          <div className={cn("flex size-11 shrink-0 items-center justify-center rounded-2xl border", statusStyles[status])}>
            <Icon className="size-5" />
          </div>

          <div>
            <h3 className="font-semibold text-white">{device.name}</h3>
            <p className="text-sm text-muted-foreground">{roomName??"Unassigned"}</p>
          </div>
        </div>

        {(canPower || canLock) && (
          <Switch
            checked={enabled}
            disabled={state.connectivity === "OFFLINE" || ["PENDING", "ACCEPTED"].includes(state.commandStatus)}
            onCheckedChange={(checked) => void store.sendCommand(device.id, canLock ? (checked ? "LOCK" : "UNLOCK") : (checked ? "TURN_ON" : "TURN_OFF")).catch(() => undefined)}
          />
        )}
      </div>

      <div className="mt-4 flex items-center justify-between gap-3 border-t border-white/10 pt-4">
        <Badge variant="outline" className={cn("rounded-full capitalize", statusStyles[status])}>
          <span className="mr-1.5 size-1.5 rounded-full bg-current" />
          {device.type==="MOTION_SENSOR"&&status!=="offline"?(state.reported.motion?"motion detected":"clear"):status}
        </Badge>

        <span className="text-xs text-muted-foreground">
          {new Date(state.lastReportedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>
    </article>
  );
}

function SecuritySensorPolicies(){
  const {securitySensorPolicies:policies,securitySensorPoliciesLoading:loading,securitySensorPolicyPendingId:pendingId,securitySensorPolicyError:error,changeSecuritySensorPolicy,rooms,currentHouse}=useSmartEstate();
  const {devices,states}=useDevices();const sensors=devices.filter(device=>device.houseId===currentHouse?.id&&["MOTION_SENSOR","CONTACT_SENSOR","ULTRASONIC_SENSOR"].includes(device.type));
  const update=(deviceId:string,key:"enabled"|"monitorArmedHome"|"monitorArmedAway",value:boolean)=>{const policy=policies.find(item=>item.deviceId===deviceId);if(!policy)return;void changeSecuritySensorPolicy(deviceId,{enabled:policy.enabled,monitorArmedHome:policy.monitorArmedHome,monitorArmedAway:policy.monitorArmedAway,[key]:value}).catch(()=>undefined);};
  return <div className="mt-5" aria-labelledby="sensor-policy-heading">
    {loading&&<p className="text-sm text-muted-foreground">Loading sensor policies…</p>}{error&&<p role="alert" className="mb-3 text-sm text-red-400">{error}</p>}
    {!loading&&sensors.length===0&&<p className="text-sm text-muted-foreground">No supported security sensors are registered for this house.</p>}
    <div className="space-y-3">{sensors.map(device=>{const policy=policies.find(item=>item.deviceId===device.id);const offline=states[device.id]?.connectivity==="OFFLINE";const pending=pendingId===device.id;return <article key={device.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
      <div className="mb-4 flex items-start justify-between"><div><h3 className="font-semibold text-white">{device.name}</h3><p className="text-sm text-muted-foreground">{rooms.find(room=>room.id===device.roomId)?.name??"Unassigned"}</p></div><Badge variant="outline" className={cn("rounded-full",offline?"border-amber-500/20 text-amber-400":"border-green-500/20 text-green-400")}>{offline?<WifiOff className="mr-1 size-3"/>:<Wifi className="mr-1 size-3"/>}{offline?"Offline":"Online"}</Badge></div>
      {!policy?<p className="text-sm text-amber-400">No policy is provisioned. This sensor will not participate in intrusion detection.</p>:<div className="grid gap-4 sm:grid-cols-3">{([['enabled','Security monitoring'],['monitorArmedHome','Armed Home'],['monitorArmedAway','Armed Away']] as const).map(([key,label])=><label key={key} className="flex items-center justify-between gap-3 rounded-lg border border-white/10 p-3 text-sm text-white"><span>{label}</span><Switch aria-label={`${device.name}: ${label}`} checked={policy[key]} disabled={pending} onCheckedChange={checked=>update(device.id,key,checked)}/></label>)}</div>}
      {offline&&<p className="mt-3 text-xs text-amber-400">Offline sensors cannot produce live security activity.</p>}{pending&&<p className="mt-3 text-xs text-muted-foreground">Saving and waiting for backend confirmation…</p>}
    </article>})}</div>
  </div>;
}

function SecurityEventsFeed() {
  const {securityEvents,securityEventsLoading,securityEventsError,rooms}=useSmartEstate();
  const {devices}=useDevices();
  return (
    <section className="rounded-[2rem] border border-white/10 bg-card/80 p-5 shadow-xl shadow-black/20 backdrop-blur">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div>
        <h2 className="text-lg font-semibold text-white">Live Events</h2>
        <p className="text-sm text-muted-foreground">
          Recent security activity across the home.
        </p>
        </div>
        <Button asChild variant="outline" className="shrink-0 rounded-xl border-white/10 bg-white/[0.04] text-white hover:bg-white/10"><Link href="/security/events">View all events</Link></Button>
      </div>

      <div className="space-y-4">
        {securityEventsLoading&&<p className="text-sm text-muted-foreground">Loading security activity…</p>}
        {securityEventsError&&<p role="alert" className="text-sm text-red-400">{securityEventsError}</p>}
        {!securityEventsLoading&&!securityEventsError&&securityEvents.length===0&&<p className="text-sm text-muted-foreground">No security activity has been recorded.</p>}
        {securityEvents.map((event) => {
          const Icon = Radar;const device=devices.find(item=>item.id===event.deviceId);const room=rooms.find(item=>item.id===device?.roomId);const detected=event.type==="MOTION_DETECTED";

          return (
            <div
              key={event.id}
              className="flex gap-3 rounded-3xl border border-white/10 bg-white/[0.03] p-4"
            >
              <div
                className={cn(
                  "flex size-10 shrink-0 items-center justify-center rounded-2xl border",
                  event.severity === "CRITICAL" && "border-red-500/20 bg-red-500/10 text-red-400",
                  detected&&"border-amber-500/20 bg-amber-500/10 text-amber-400",
                  !detected&&"border-green-500/20 bg-green-500/10 text-green-400"
                )}
              >
                <Icon className="size-4" />
              </div>

              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-semibold text-white">
                      {detected?"Motion detected":"Motion cleared"}
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      {room?.name??device?.name??"Unknown location"}
                    </p>
                  </div>

                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(event.occurredAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

    </section>
  );
}
