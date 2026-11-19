"use client";

import * as React from "react";
import { ExternalLink, Link2, LoaderCircle, RefreshCw, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Status = { connected: boolean; state: string; localGrantActive: boolean; amazonEnabled: boolean; amazonLinked: boolean; connectedAt: string | null; lastVerifiedAt: string | null; capabilities: string[] };
const stateLabels: Record<string, string> = { not_connected: "Not connected", connected: "Connected", verification_pending: "Verification pending", connection_unavailable: "Connection unavailable", relink_required: "Relink required", unlink_pending: "Amazon unlink pending", locally_revoked: "Disconnected" };
const resultMessages: Record<string, string> = { connected: "Amazon Alexa is connected.", pending: "Amazon is still verifying the connection.", cancelled: "Amazon authorization was cancelled.", invalid_state: "The linking request expired or was already used. Please try again.", already_connecting: "A linking request is already in progress.", already_connected: "Alexa is already connected or being reconciled.", ineligible: "This account has no eligible lights or fans to connect.", unavailable: "Website linking is not configured.", failed: "Amazon could not complete account linking. Please try again." };

export function AlexaIntegrationCard() {
  const [status, setStatus] = React.useState<Status | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  const load = React.useCallback(() => {
    const controller = new AbortController();
    fetch("/api/integrations/alexa/status", { cache: "no-store", signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("Unable to load Alexa connection state."); return response.json() as Promise<Status>; })
      .then(value => { setStatus(value); setError(""); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load Alexa connection state."); });
    return controller;
  }, []);
  React.useEffect(() => { const controller = load(); const result = new URLSearchParams(window.location.search).get("result"); const timer = result ? window.setTimeout(() => setError(resultMessages[result] ?? "Alexa linking did not complete."), 0) : undefined; return () => { controller.abort(); if (timer) window.clearTimeout(timer); }; }, [load]);
  async function disconnect() {
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/integrations/alexa/status", { method: "DELETE" });
      if (![202, 204].includes(response.status)) throw new Error("Alexa could not be disconnected.");
      setStatus(previous => previous ? { ...previous, connected: false, localGrantActive: false, state: response.status === 202 ? "unlink_pending" : "locally_revoked" } : previous);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Alexa could not be disconnected."); }
    finally { setBusy(false); }
  }
  const connectable = !status?.connected && !["verification_pending", "unlink_pending"].includes(status?.state ?? "");
  const tone = status?.connected ? "border-green-500/20 bg-green-500/10 text-green-500" : status?.state === "relink_required" ? "border-amber-500/20 bg-amber-500/10 text-amber-500" : "border-border text-muted-foreground";
  return (
    <Card className="border-border/70 bg-card/80 shadow-xl shadow-black/10 backdrop-blur">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-500"><Link2 className="size-5" /></div><div><CardTitle>Amazon Alexa</CardTitle><CardDescription>Control authorized Nexora lights and fans with Alexa.</CardDescription></div></div>
          {status ? <Badge variant="outline" className={tone}>{stateLabels[status.state] ?? "Unavailable"}</Badge> : <LoaderCircle className="size-5 animate-spin text-muted-foreground" aria-label="Loading Alexa status" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div aria-live="polite">{error && <p className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-3 text-sm text-amber-600 dark:text-amber-300">{error}</p>}</div>
        <div className="rounded-xl border border-border/70 bg-muted/30 p-4 text-sm text-muted-foreground"><p className="font-medium text-foreground">Available capabilities</p><p className="mt-2">{status?.capabilities.join(" · ") || "Power control · Device state · Connectivity health"}</p></div>
        <p className="text-sm leading-6 text-muted-foreground">Connect securely in this browser with your Amazon account. The traditional Alexa app linking flow remains available. Gates and security controls are never shared with Alexa.</p>
        {status?.lastVerifiedAt && <p className="text-xs text-muted-foreground">Last verified {new Date(status.lastVerifiedAt).toLocaleString()}</p>}
        <div className="flex flex-wrap items-center gap-3">
          {connectable && <Button asChild className="rounded-xl bg-[#00a8e1] text-white hover:bg-[#0096c9]"><a href="/api/integrations/alexa/connect" aria-label="Connect Amazon Alexa"><ExternalLink />Connect Amazon Alexa</a></Button>}
          {status?.state === "verification_pending" && <Button variant="outline" onClick={() => load()}><RefreshCw />Check status</Button>}
          {(status?.localGrantActive || ["connected", "verification_pending", "relink_required"].includes(status?.state ?? "")) && <Button variant="outline" disabled={busy} onClick={disconnect} className="border-red-500/20 text-red-600 hover:bg-red-500/10 dark:text-red-300">{busy ? <LoaderCircle className="animate-spin" /> : <Unplug />} {busy ? "Disconnecting" : "Disconnect"}</Button>}
        </div>
      </CardContent>
    </Card>
  );
}
