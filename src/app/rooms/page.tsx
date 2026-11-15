"use client";
import { DoorOpen, Wifi, WifiOff } from "lucide-react";
import { DashboardShell } from "@/components/dashboard-shell";
import { DashboardEmptyState } from "@/components/dashboard-empty-state";
import { useDevices, useSmartEstate } from "@/components/providers/device-state-provider";

export default function RoomsPage() {
  const { rooms, currentHouse, status, houseLoading, error } = useSmartEstate(); const { devices, states } = useDevices();
  return <DashboardShell><section><p className="text-sm text-muted-foreground">{currentHouse?.name ?? "No house selected"}</p><h1 className="mt-1 text-3xl font-semibold text-white">Rooms</h1><p className="mt-2 text-sm text-muted-foreground">Registered rooms and assigned devices.</p></section>
    {error ? <div role="alert" className="rounded-2xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-300">Unable to load rooms: {error}</div> : status === "loading" || houseLoading ? <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[1,2,3].map(i=><div key={i} className="h-44 animate-pulse rounded-3xl bg-white/[0.04]" />)}</div> : rooms.length === 0 ? <DashboardEmptyState icon={DoorOpen} title="No rooms added yet" description="Rooms registered for this house will appear here. Room creation is not currently available in the dashboard." /> : <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{rooms.map(room=>{const assigned=devices.filter(d=>d.roomId===room.id);const online=assigned.filter(d=>states[d.id]?.connectivity==="ONLINE").length;return <article key={room.id} className="rounded-3xl border border-white/10 bg-card/80 p-5"><div className="flex items-center justify-between"><div className="flex size-11 items-center justify-center rounded-2xl bg-blue-500/10 text-blue-400"><DoorOpen className="size-5" /></div><span className="text-xs text-muted-foreground">{assigned.length} devices</span></div><h2 className="mt-5 text-lg font-semibold text-white">{room.name}</h2><div className="mt-4 flex gap-4 text-sm"><span className="flex items-center gap-2 text-green-400"><Wifi className="size-4" />{online} online</span><span className="flex items-center gap-2 text-muted-foreground"><WifiOff className="size-4" />{assigned.length-online} offline</span></div></article>})}</section>}
  </DashboardShell>;
}
