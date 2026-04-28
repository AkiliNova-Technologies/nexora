"use client";

import * as React from "react";
import { AppSidebar } from "@/components/app-sidebar";
import { SiteHeader } from "@/components/site-header";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Armchair,
  BedDouble,
  ChefHat,
  Home,
  Lightbulb,
  MonitorDot,
  Music,
  Plus,
  Snowflake,
  Sofa,
  Sparkles,
  Thermometer,
  VenetianMask,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";

const rooms = [
  {
    name: "Living Room",
    icon: Sofa,
    devicesOn: 8,
    temperature: "22°C",
    scene: "Movie Night",
    active: true,
    tone: "blue",
  },
  {
    name: "Master Bedroom",
    icon: BedDouble,
    devicesOn: 3,
    temperature: "20°C",
    scene: "Sleep Mode",
    active: false,
    tone: "neutral",
  },
  {
    name: "Kitchen",
    icon: ChefHat,
    devicesOn: 5,
    temperature: "24°C",
    scene: "Morning Prep",
    active: false,
    tone: "amber",
  },
  {
    name: "Home Office",
    icon: MonitorDot,
    devicesOn: 5,
    temperature: "21°C",
    scene: "Focus Scene",
    active: false,
    tone: "green",
  },
  {
    name: "Home Theater",
    icon: Armchair,
    devicesOn: 0,
    temperature: "Eco",
    scene: "Standby",
    active: false,
    tone: "neutral",
  },
  {
    name: "Outdoor",
    icon: Home,
    devicesOn: 2,
    temperature: "18°C",
    scene: "Night Watch",
    active: false,
    tone: "neutral",
  },
];

const livingRoomDevices = [
  {
    name: "Ceiling Spotlights",
    meta: "Brightness: 80%",
    icon: Lightbulb,
    enabled: true,
  },
  {
    name: "Floor Lamp",
    meta: "Color: Warm White",
    icon: Lightbulb,
    enabled: true,
  },
  {
    name: "Air Conditioner",
    meta: "Setting: Cooling",
    icon: Snowflake,
    enabled: true,
  },
  {
    name: "Window Blinds",
    meta: "Status: Closed",
    icon: VenetianMask,
    enabled: false,
  },
  {
    name: "Living Soundbar",
    meta: "Playing: Lo-fi Chill",
    icon: Music,
    enabled: true,
  },
];

export default function RoomsPage() {
  const [selectedRoom, setSelectedRoom] = React.useState(rooms[0]);

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
          <div className="mx-auto flex w-full flex-col gap-8 px-4 py-5 md:px-6 md:py-7">
            <section className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm text-muted-foreground">
                  Room-based smart control
                </p>
                <h1 className="mt-1 text-3xl font-semibold tracking-tight text-white">
                  Rooms Control
                </h1>
              </div>

              <Button className="w-fit rounded-2xl bg-blue-500 px-5 text-white shadow-lg shadow-blue-500/20 hover:bg-blue-400">
                <Plus className="size-4" />
                Add New Room
              </Button>
            </section>

            <section className="grid grid-cols-1 gap-6 xl:grid-cols-[1.6fr_0.9fr]">
              <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
                {rooms.map((room) => (
                  <RoomCard
                    key={room.name}
                    room={room}
                    selected={selectedRoom.name === room.name}
                    onClick={() => setSelectedRoom(room)}
                  />
                ))}
              </div>

              <RoomControlPanel room={selectedRoom} />
            </section>
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}

function RoomCard({
  room,
  selected,
  onClick,
}: {
  room: (typeof rooms)[number];
  selected: boolean;
  onClick: () => void;
}) {
  const Icon = room.icon;

  return (
    <button
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-3xl border bg-card/70 p-6 text-left shadow-xl shadow-black/20 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/20",
        selected ? "border-blue-500/70 bg-blue-500/[0.08]" : "border-white/10",
      )}
    >

      <div className="relative">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div
            className={cn(
              "flex size-12 items-center justify-center rounded-2xl border",
              selected
                ? "border-blue-500/30 bg-blue-500/20 text-blue-400"
                : "border-white/10 bg-white/[0.04] text-white",
            )}
          >
            <Icon className="size-6" />
          </div>

          <div className="flex flex-col items-end gap-2">
            <span
              className={cn(
                "rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider",
                room.devicesOn > 0
                  ? "bg-green-500/10 text-green-400"
                  : "bg-white/[0.04] text-muted-foreground",
              )}
            >
              {room.devicesOn > 0 ? `${room.devicesOn} Devices On` : "Standby"}
            </span>

            <span className="rounded-full bg-blue-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-blue-400">
              Climate: {room.temperature}
            </span>
          </div>
        </div>

        <h2 className="text-xl font-semibold text-white">{room.name}</h2>

        <p className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
          <Sparkles className="size-3.5" />
          Active: {room.scene}
        </p>

        <div className="mt-6 flex gap-2">
          {[0, 1, 2].map((item) => (
            <div
              key={item}
              className={cn(
                "h-1 flex-1 rounded-full",
                selected && item === 0 ? "bg-blue-500" : "bg-white/10",
              )}
            />
          ))}
        </div>
      </div>
    </button>
  );
}

function TemperatureControl() {
  const MIN = 16;
  const MAX = 30;

  const [temp, setTemp] = React.useState([22]);

  const percentage = ((temp[0] - MIN) / (MAX - MIN)) * 100;

  return (
    <div className="mt-8 border-t border-white/10 pt-8">
      <div className="mb-5 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-[0.2em] text-white">
          Temperature
        </h3>

        <div className="flex items-center gap-2 text-blue-400">
          <Thermometer className="size-5" />
          <span className="text-2xl font-black">{temp[0]}°C</span>
        </div>
      </div>

      <div className="relative">
        {/* Track */}
        <div className="absolute inset-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-white/10" />

        {/* Active gradient */}
        <div
          className="pointer-events-none absolute top-1/2 h-2 -translate-y-1/2 rounded-full bg-gradient-to-r from-blue-600 to-blue-400"
          style={{ width: `${percentage}%` }}
        />

        {/* Slider */}
        <Slider
          value={temp}
          min={MIN}
          max={MAX}
          step={1}
          onValueChange={setTemp}
          className="relative z-10"
        />
      </div>

      <div className="mt-3 flex justify-between text-[10px] font-bold text-muted-foreground">
        <span>{MIN}°C</span>
        <span>{MAX}°C</span>
      </div>
    </div>
  );
}

function RoomControlPanel({ room }: { room: (typeof rooms)[number] }) {
  const Icon = room.icon;

  return (
    <aside className="rounded-[2rem] border border-blue-500/30 bg-card/80 p-6 shadow-2xl shadow-black/30 backdrop-blur xl:sticky xl:top-24">
      <div className="mb-8 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex size-11 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-400">
            <Icon className="size-5" />
          </div>

          <div>
            <h2 className="text-xl font-bold text-white">{room.name}</h2>
            <p className="text-xs text-muted-foreground">
              {room.devicesOn} active devices
            </p>
          </div>
        </div>

        <button className="text-sm font-medium text-blue-400 transition hover:text-blue-300">
          Turn all off
        </button>
      </div>

      <div className="space-y-4">
        {livingRoomDevices.map((device) => {
          const DeviceIcon = device.icon;

          return (
            <div
              key={device.name}
              className={cn(
                "flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4",
                !device.enabled && "opacity-60",
              )}
            >
              <div className="flex items-center gap-4">
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-xl",
                    device.enabled
                      ? "bg-blue-500/15 text-blue-400"
                      : "bg-white/10 text-muted-foreground",
                  )}
                >
                  <DeviceIcon className="size-4" />
                </div>

                <div>
                  <p className="text-sm font-semibold text-white">
                    {device.name}
                  </p>
                  <p className="text-xs text-muted-foreground">{device.meta}</p>
                </div>
              </div>

              <Switch defaultChecked={device.enabled} />
            </div>
          );
        })}
      </div>

      <TemperatureControl />
    </aside>
  );
}
