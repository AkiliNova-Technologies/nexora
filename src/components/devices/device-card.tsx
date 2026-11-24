"use client";

import * as React from "react";
import {
  BellRing,
  Camera,
  Cpu,
  DoorOpen,
  Fan,
  Lightbulb,
  PlugZap,
  ShieldCheck,
  SlidersHorizontal,
  Thermometer,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getCapability } from "@/lib/device-capabilities";
import type { DeviceCommandRequest } from "@/lib/api/contracts";
import type { Device, DeviceCommandType, DeviceState, DeviceType } from "@/domain/smart-estate";

export type DeviceStatus = "online" | "offline" | "warning";
export type DeviceCommandParameters = DeviceCommandRequest["parameters"];
export type DeviceCommandHandler = (command: DeviceCommandType, parameters?: DeviceCommandParameters) => Promise<unknown>;

export const deviceIconMap = {
  LIGHT: Lightbulb,
  FAN: Fan,
  THERMOSTAT: Thermometer,
  SMART_PLUG: PlugZap,
  CAMERA: Camera,
  CONTACT_SENSOR: ShieldCheck,
  MOTION_SENSOR: ShieldCheck,
  LOCK: ShieldCheck,
  BLIND: SlidersHorizontal,
  SPEAKER: Cpu,
  TEMPERATURE_SENSOR: Thermometer,
  HUMIDITY_SENSOR: Thermometer,
  ULTRASONIC_SENSOR: ShieldCheck,
  RGB_LIGHT: Lightbulb,
  SIREN: BellRing,
  GATE: DoorOpen,
} satisfies Record<DeviceType, React.ElementType>;

const colorPresets = [
  { name: "White", r: 255, g: 255, b: 255 },
  { name: "Warm", r: 255, g: 170, b: 80 },
  { name: "Red", r: 255, g: 0, b: 0 },
  { name: "Green", r: 0, g: 200, b: 80 },
  { name: "Blue", r: 40, g: 110, b: 255 },
  { name: "Purple", r: 150, g: 60, b: 255 },
] as const;

const isBusy = (state: DeviceState) => state.commandStatus === "PENDING" || state.commandStatus === "ACCEPTED";

function getDeviceControl(device: Device, state: DeviceState) {
  const brightness = getCapability(device, "BRIGHTNESS");
  if (brightness) return { kind: "slider" as const, label: "Brightness", command: "SET_BRIGHTNESS" as const, value: state.reported.brightness ?? 0, unit: "%", ...brightness };
  const fanSpeed = getCapability(device, "FAN_SPEED");
  if (fanSpeed) return { kind: "slider" as const, label: "Fan Speed", command: "SET_FAN_SPEED" as const, value: state.reported.fanSpeed ?? 0, unit: "%", ...fanSpeed };
  const temperature = getCapability(device, "TARGET_TEMPERATURE");
  if (temperature) return { kind: "slider" as const, label: "Temperature", command: "SET_TARGET_TEMPERATURE" as const, value: state.reported.targetTemperature ?? 22, ...temperature, unit: "°C" };
  if (device.type === "CAMERA") return { kind: "camera" as const };
  if (device.type === "GATE") return { kind: "status" as const, label: "Gate", value: "Use the gate workspace" };
  if (device.type === "SIREN") return { kind: "status" as const, label: "Alarm", value: "Sounds on intrusion" };
  return { kind: "status" as const, label: device.type === "SMART_PLUG" ? "Power Load" : "Sensor Reading", value: device.type === "SMART_PLUG" ? "Monitoring usage" : "Auto-reporting" };
}

function getDeviceReading(device: Device, state: DeviceState) {
  const reported = state.reported as Record<string, unknown>;
  switch (device.type) {
    case "LIGHT":
    case "RGB_LIGHT": return `${state.reported.brightness ?? (state.reported.on ? 100 : 0)}%`;
    case "THERMOSTAT": return state.reported.targetTemperature == null ? "—" : `${state.reported.targetTemperature}°C`;
    case "FAN": return state.reported.fanSpeed == null ? (state.reported.on ? "On" : "Off") : `${state.reported.fanSpeed}%`;
    case "SMART_PLUG": return `${state.reported.powerWatts ?? 0}W`;
    case "CAMERA": return state.connectivity === "OFFLINE" ? "No feed" : "Live";
    case "CONTACT_SENSOR": return state.reported.batteryPercent == null ? "Reporting" : `${state.reported.batteryPercent}% battery`;
    case "SIREN": return state.reported.on ? "Sounding" : "Silent";
    case "GATE": return typeof reported.position === "string" ? reported.position : "Unknown";
    case "MOTION_SENSOR": return typeof reported.motion === "boolean" ? (reported.motion ? "Motion" : "Clear") : state.connectivity === "ONLINE" ? "Reporting" : "Unavailable";
    default: return state.connectivity === "ONLINE" ? "Reporting" : "Unavailable";
  }
}

function deviceMeta(device: Device) {
  if (getCapability(device, "RGB_COLOR")) return "Colour & brightness";
  if (getCapability(device, "BRIGHTNESS")) return "Brightness control";
  if (getCapability(device, "FAN_SPEED")) return "Speed control";
  if (getCapability(device, "TARGET_TEMPERATURE")) return "Cooling mode";
  if (getCapability(device, "SIREN_CONTROL")) return "Alarm siren";
  if (device.type === "GATE") return "Entrance gate";
  if (device.type === "SMART_PLUG") return "Power control";
  if (device.type === "CAMERA") return "Camera monitoring";
  if (getCapability(device, "POWER")) return "Power control";
  return "Status reporting";
}

function DeviceControl({ device, state, status, control, onCommand }: { device: Device; state: DeviceState; status: DeviceStatus; control: ReturnType<typeof getDeviceControl>; onCommand: DeviceCommandHandler }) {
  const disabled = state.reported.on === false || status === "offline" || isBusy(state);

  if (control.kind === "slider") {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
        <div className="mb-3 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{control.label}</span>
          <span className="text-xs font-semibold text-blue-400">{control.value}{control.unit}</span>
        </div>
        <Slider
          key={`${device.id}-${control.value}`}
          defaultValue={[control.value]}
          onValueCommit={([value]) => void onCommand(control.command, { value }).catch(() => undefined)}
          min={control.min}
          max={control.max}
          step={1}
          disabled={disabled}
        />
      </div>
    );
  }

  if (control.kind === "camera") {
    return (
      <div className="grid grid-cols-2 gap-2">
        {["View Feed", "Record"].map((action) => (
          <Button
            key={action}
            variant="outline"
            disabled={disabled}
            onClick={action === "Record" ? () => void onCommand("START_RECORDING").catch(() => undefined) : undefined}
            className="rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/10"
          >
            {action}
          </Button>
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{control.label}</span>
        <span className="text-xs font-semibold text-white">{control.value}</span>
      </div>
    </div>
  );
}

function ColorControl({ state, status, onCommand }: { state: DeviceState; status: DeviceStatus; onCommand: DeviceCommandHandler }) {
  const disabled = state.reported.on === false || status === "offline" || isBusy(state);
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <span className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">Colour</span>
      <div className="mt-3 flex flex-wrap gap-2">
        {colorPresets.map((color) => (
          <button
            key={color.name}
            type="button"
            title={color.name}
            aria-label={`Set colour to ${color.name}`}
            disabled={disabled}
            onClick={() => void onCommand("SET_RGB", { r: color.r, g: color.g, b: color.b }).catch(() => undefined)}
            className="size-8 rounded-full border border-white/20 transition hover:scale-110 disabled:cursor-not-allowed disabled:opacity-40"
            style={{ backgroundColor: `rgb(${color.r} ${color.g} ${color.b})` }}
          />
        ))}
      </div>
    </div>
  );
}

function SirenControl({ device, state, status, onCommand }: { device: Device; state: DeviceState; status: DeviceStatus; onCommand: DeviceCommandHandler }) {
  const siren = getCapability(device, "SIREN_CONTROL");
  if (!siren) return null;
  const seconds = Math.max(1, Math.min(10, siren.maxDurationSeconds));
  const disabled = status === "offline" || isBusy(state);
  return (
    <div className="grid grid-cols-2 gap-2">
      <Button variant="outline" disabled={disabled} onClick={() => void onCommand("ACTIVATE_SIREN", { durationSeconds: seconds }).catch(() => undefined)} className="rounded-2xl border-red-500/30 bg-red-500/10 text-red-300 hover:bg-red-500/20">
        Sound {seconds}s
      </Button>
      <Button variant="outline" disabled={disabled} onClick={() => void onCommand("STOP_SIREN").catch(() => undefined)} className="rounded-2xl border-white/10 bg-white/[0.04] text-white hover:bg-white/10">
        Stop
      </Button>
    </div>
  );
}

/**
 * Device card shared by the homeowner and estate administrator dashboards.
 * `extendedControls` adds colour presets and siren controls, which only the
 * administrator workspace exposes.
 */
export function DeviceCard({
  device,
  state,
  compact,
  subtitle,
  onCommand,
  extendedControls = false,
}: {
  device: Device;
  state: DeviceState;
  compact?: boolean;
  subtitle?: string;
  onCommand: DeviceCommandHandler;
  extendedControls?: boolean;
}) {
  const [message, setMessage] = React.useState<string | null>(null);
  const Icon = deviceIconMap[device.type] ?? Cpu;
  const enabled = state.reported.on ?? true;
  const status: DeviceStatus = state.connectivity === "OFFLINE" || state.connectivity === "UNAVAILABLE" ? "offline" : state.reported.powerWatts && state.reported.powerWatts > 700 ? "warning" : "online";
  const control = getDeviceControl(device, state);
  const canPower = getCapability(device, "POWER") !== undefined;
  const busy = isBusy(state);
  const run: DeviceCommandHandler = async (command, parameters) => {
    setMessage(null);
    try { return await onCommand(command, parameters); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Command failed"); throw error; }
  };

  return (
    <div className={cn("rounded-3xl border border-white/10 bg-card/80 p-5 shadow-xl shadow-black/20 backdrop-blur transition hover:-translate-y-0.5 hover:border-white/20", compact && "grid grid-cols-1 gap-5 md:grid-cols-[1fr_auto] md:items-center")}>
      <div className="flex items-start justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          <div className={cn("flex size-12 shrink-0 items-center justify-center rounded-2xl border", enabled ? "border-blue-500/20 bg-blue-500/10 text-blue-400" : "border-white/10 bg-white/[0.04] text-muted-foreground")}>
            <Icon className="size-5" />
          </div>
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-white">{device.name}</h2>
            <p className="truncate text-sm text-muted-foreground">{subtitle ?? "Unassigned"} · {deviceMeta(device)}</p>
          </div>
        </div>
        {canPower && (
          <Switch
            checked={enabled}
            aria-label={`Turn ${device.name} ${enabled ? "off" : "on"}`}
            disabled={status === "offline" || busy}
            onCheckedChange={(checked) => void run(checked ? "TURN_ON" : "TURN_OFF").catch(() => undefined)}
          />
        )}
      </div>

      <div className={cn("mt-6 space-y-4", compact && "mt-0 md:w-[360px]")}>
        <div className="flex items-center justify-between gap-3">
          <StatusBadge status={status} />
          <span className="text-sm font-semibold text-white">{getDeviceReading(device, state)}</span>
        </div>

        <DeviceControl device={device} state={state} status={status} control={control} onCommand={run} />
        {extendedControls && getCapability(device, "RGB_COLOR") && <ColorControl state={state} status={status} onCommand={run} />}
        {extendedControls && <SirenControl device={device} state={state} status={status} onCommand={run} />}

        {message && <p role="alert" className="text-xs text-red-300">{message}</p>}
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{state.lastReportedAt ? new Date(state.lastReportedAt).toLocaleString() : "Never reported"}</span>
          <span>{busy ? state.commandStatus : state.commandStatus === "FAILED" || state.commandStatus === "TIMEOUT" ? state.commandStatus : enabled ? "Active" : "Inactive"}</span>
        </div>
      </div>
    </div>
  );
}

export function StatusBadge({ status }: { status: DeviceStatus }) {
  const styles = {
    online: "border-green-500/20 bg-green-500/10 text-green-400",
    offline: "border-red-500/20 bg-red-500/10 text-red-400",
    warning: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  };
  return (
    <Badge variant="outline" className={cn("rounded-full", styles[status])}>
      <span className="mr-1.5 size-1.5 rounded-full bg-current" />
      {status}
    </Badge>
  );
}
