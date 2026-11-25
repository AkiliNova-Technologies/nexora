"use client";

import * as React from "react";
import { Eye, EyeOff, LoaderCircle, Lock, RefreshCw, Wifi, WifiHigh, WifiLow, WifiZero } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { smartEstateApi, type ProvisioningRequestStatus, type ScannedWifiNetwork } from "@/lib/api/client";
import type { AdminControllerSummary } from "@/lib/api/contracts";
import { cn } from "@/lib/utils";

const TERMINAL = new Set(["SUCCEEDED", "FAILED", "EXPIRED", "CANCELLED"]);
const POLL_MS = 2000;
const GIVE_UP_MS = 5 * 60_000;

type Tracked = { id: string; kind: "scan" | "connect"; ssid?: string };
type Notice = { tone: "info" | "ok" | "error"; text: string } | null;

function SignalIcon({ rssi }: { rssi: number }) {
  const Icon = rssi >= -55 ? Wifi : rssi >= -67 ? WifiHigh : rssi >= -78 ? WifiLow : WifiZero;
  const label = rssi >= -55 ? "Excellent" : rssi >= -67 ? "Good" : rssi >= -78 ? "Fair" : "Weak";
  return <Icon className="size-4 shrink-0 text-blue-400" aria-label={`${label} signal, ${rssi} dBm`} />;
}

/** What the admin should see for the request being followed. */
function describe(tracked: Tracked, request: ProvisioningRequestStatus | null): Notice {
  const status = request?.status ?? "PENDING";
  if (tracked.kind === "scan") {
    if (status === "PENDING" || status === "CLAIMED") return { tone: "info", text: "Asking the controller to scan…" };
    if (status === "PUBLISHED") return { tone: "info", text: "The controller is scanning for networks…" };
    if (status === "SUCCEEDED") return null;
    if (status === "FAILED") return { tone: "error", text: request?.error ?? "The scan failed. Try again." };
    if (status === "CANCELLED") return { tone: "info", text: "The scan was replaced by a newer request." };
    return { tone: "error", text: request?.acknowledgedAt || request?.acknowledgement ? "The controller didn't finish the scan in time." : "The controller didn't receive the request. Check that it's online and that Wi-Fi setup is enabled on the bridge." };
  }
  const name = tracked.ssid ?? "the network";
  if (status === "PENDING" || status === "CLAIMED") return { tone: "info", text: "Sending the network details to the controller…" };
  if (status === "PUBLISHED") {
    return request?.acknowledgement?.status === "ACCEPTED"
      ? { tone: "info", text: `Testing ${name}. The controller may be offline for up to 2 minutes while it switches.` }
      : { tone: "info", text: "Delivered. Waiting for the controller to start…" };
  }
  if (status === "SUCCEEDED") return { tone: "ok", text: `Connected to ${name}. The controller saved this network.` };
  if (status === "FAILED") return { tone: "error", text: `Couldn't switch to ${name}: ${request?.error ?? "the controller rejected it"}. It stayed on, or returned to, its previous network.` };
  if (status === "CANCELLED") return { tone: "info", text: "The network change was replaced by a newer request." };
  return { tone: "error", text: "No confirmation from the controller. Check its status before trying again." };
}

export function ControllerWifi({ controller }: { controller: AdminControllerSummary }) {
  const [tracked, setTracked] = React.useState<Tracked | null>(null);
  const [request, setRequest] = React.useState<ProvisioningRequestStatus | null>(null);
  const [networks, setNetworks] = React.useState<ScannedWifiNetwork[] | null>(null);
  const [currentSsid, setCurrentSsid] = React.useState<string | null>(controller.wifiSsid ?? null);
  const [selected, setSelected] = React.useState<{ ssid: string; secure: boolean } | null>(null);
  const [manualSsid, setManualSsid] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const [notice, setNotice] = React.useState<Notice>(null);
  const [sending, setSending] = React.useState(false);
  const formId = `wifi-${controller.id}`;

  // Follow the current request until the controller reports a final outcome.
  React.useEffect(() => {
    if (!tracked) return;
    let active = true;
    const started = Date.now();
    let timer: number | undefined;
    const tick = async () => {
      try {
        const status = await smartEstateApi.provisioningStatus(controller.id);
        const found = status.requests.find((item) => item.id === tracked.id);
        if (!active) return;
        if (found) {
          setRequest(found);
          if (TERMINAL.has(found.status)) {
            if (tracked.kind === "scan" && found.status === "SUCCEEDED") {
              setNetworks(found.acknowledgement?.networks ?? []);
              if (found.acknowledgement?.currentSsid) setCurrentSsid(found.acknowledgement.currentSsid);
            }
            if (tracked.kind === "connect" && found.status === "SUCCEEDED" && tracked.ssid) { setCurrentSsid(tracked.ssid); setSelected(null); }
            return;
          }
        }
      } catch { /* keep polling; a single failed refresh is not an outcome */ }
      if (active && Date.now() - started < GIVE_UP_MS) timer = window.setTimeout(() => void tick(), POLL_MS);
    };
    timer = window.setTimeout(() => void tick(), 1200);
    return () => { active = false; window.clearTimeout(timer); };
  }, [controller.id, tracked]);

  const inProgress = Boolean(tracked && !TERMINAL.has(request?.status ?? "PENDING"));
  const status = tracked ? describe(tracked, request) : null;
  const shown = notice ?? status;

  async function scan() {
    setSending(true); setNotice(null); setSelected(null);
    try {
      const created = await smartEstateApi.wifiScan(controller.id);
      setRequest(null); setTracked({ id: created.id, kind: "scan" });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "The scan couldn't be requested." });
    } finally { setSending(false); }
  }

  async function connect(event: React.FormEvent) {
    event.preventDefault();
    const ssid = selected?.ssid === "" ? manualSsid.trim() : selected?.ssid ?? "";
    const secure = selected?.secure ?? true;
    if (!ssid) { setNotice({ tone: "error", text: "Enter the network name." }); return; }
    if ((secure || password) && (password.length < 8 || password.length > 63)) { setNotice({ tone: "error", text: "Wi-Fi passwords are 8 to 63 characters." }); return; }
    setSending(true); setNotice(null);
    try {
      const created = await smartEstateApi.wifiConnect(controller.id, { ssid, password: secure ? password : "" });
      setPassword(""); setShowPassword(false);
      setRequest(null); setTracked({ id: created.id, kind: "connect", ssid });
    } catch (error) {
      setNotice({ tone: "error", text: error instanceof Error ? error.message : "The network change couldn't be requested." });
    } finally { setSending(false); }
  }

  const offline = controller.networkState !== "ONLINE";

  return (
    <section className="mt-5 border-t border-white/10 pt-4" aria-labelledby={`${formId}-title`}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <h3 id={`${formId}-title`} className="text-sm font-semibold text-white">Wi-Fi network</h3>
          <p className="truncate text-xs text-muted-foreground">
            {currentSsid ? `Connected to ${currentSsid}${controller.wifiRssi != null ? ` · ${controller.wifiRssi} dBm` : ""}` : "Current network unknown"}
          </p>
        </div>
        <Button size="sm" variant="outline" className="border-white/10" disabled={sending || inProgress} onClick={() => void scan()}>
          {inProgress && tracked?.kind === "scan" ? <LoaderCircle className="animate-spin" /> : <RefreshCw />}
          {networks ? "Scan again" : "Scan for networks"}
        </Button>
      </div>

      {offline && <p className="mt-3 text-xs text-amber-300">The controller looks offline. Changing Wi-Fi from here needs it online; if it can&apos;t connect, use its setup hotspot on site.</p>}

      {shown && (
        <p role={shown.tone === "error" ? "alert" : "status"} className={cn("mt-3 flex items-start gap-2 text-xs", shown.tone === "error" ? "text-red-300" : shown.tone === "ok" ? "text-green-400" : "text-muted-foreground")}>
          {inProgress && <LoaderCircle className="mt-0.5 size-3.5 shrink-0 animate-spin" />}{shown.text}
        </p>
      )}

      {networks && (
        <ul className="mt-3 divide-y divide-white/10 overflow-hidden rounded-xl border border-white/10">
          {networks.length === 0 && <li className="px-3 py-3 text-xs text-muted-foreground">No networks found. Move closer to the router or scan again.</li>}
          {networks.map((network) => {
            const isCurrent = network.ssid === currentSsid;
            const isSelected = selected?.ssid === network.ssid;
            return (
              <li key={network.ssid}>
                <button
                  type="button"
                  disabled={inProgress || isCurrent}
                  aria-expanded={isSelected}
                  onClick={() => { setSelected(isSelected ? null : { ssid: network.ssid, secure: network.secure }); setPassword(""); setNotice(null); }}
                  className={cn("flex w-full items-center gap-3 px-3 py-2.5 text-left text-sm transition hover:bg-white/[0.04] disabled:cursor-default disabled:hover:bg-transparent", isSelected && "bg-blue-500/10")}
                >
                  <SignalIcon rssi={network.rssi} />
                  <span className="min-w-0 flex-1 truncate text-white">{network.ssid}</span>
                  {isCurrent && <span className="rounded-full border border-green-500/30 bg-green-500/10 px-2 py-0.5 text-[11px] text-green-400">Connected</span>}
                  {network.secure ? <Lock className="size-3.5 shrink-0 text-muted-foreground" aria-label="Password protected" /> : <span className="text-[11px] text-muted-foreground">Open</span>}
                </button>
              </li>
            );
          })}
          <li>
            <button type="button" disabled={inProgress} onClick={() => { setSelected(selected?.ssid === "" ? null : { ssid: "", secure: true }); setPassword(""); setNotice(null); }} className="w-full px-3 py-2.5 text-left text-sm text-blue-400 hover:bg-white/[0.04]">
              Other network (hidden or not listed)…
            </button>
          </li>
        </ul>
      )}

      {selected && (
        <form id={formId} onSubmit={(event) => void connect(event)} className="mt-3 grid gap-2 rounded-xl border border-white/10 bg-white/[0.03] p-3">
          {selected.ssid === "" ? (
            <Input id={`${formId}-ssid`} value={manualSsid} onChange={(event) => setManualSsid(event.target.value)} maxLength={32} placeholder="Network name" autoComplete="off" className="border-white/10" />
          ) : (
            <p className="text-sm text-white">Connect to <span className="font-semibold">{selected.ssid}</span></p>
          )}
          {selected.secure && (
            <div className="relative">
              <Input id={`${formId}-password`} type={showPassword ? "text" : "password"} value={password} onChange={(event) => setPassword(event.target.value)} maxLength={63} placeholder="Wi-Fi password" autoComplete="new-password" className="border-white/10 pr-10" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Hide password" : "Show password"} className="absolute top-1/2 right-2 -translate-y-1/2 text-muted-foreground hover:text-white">
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          )}
          <p className="text-[11px] leading-4 text-muted-foreground">The controller tests the network and its cloud connection before saving it. If either fails, it returns to its current network automatically.</p>
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={sending || inProgress}>{sending ? <LoaderCircle className="animate-spin" /> : null}Connect</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setSelected(null); setPassword(""); }}>Cancel</Button>
          </div>
        </form>
      )}
    </section>
  );
}
