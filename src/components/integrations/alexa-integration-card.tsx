"use client";

import * as React from "react";
import { Link2, LoaderCircle, Unplug } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type Status = { connected: boolean; connectedAt: string | null; capabilities: string[] };

export function AlexaIntegrationCard() {
  const [status, setStatus] = React.useState<Status | null>(null);
  const [error, setError] = React.useState("");
  const [busy, setBusy] = React.useState(false);
  React.useEffect(() => {
    const controller = new AbortController();
    fetch("/api/integrations/alexa/status", { cache: "no-store", signal: controller.signal })
      .then(response => { if (!response.ok) throw new Error("Unable to load Alexa connection state."); return response.json() as Promise<Status>; })
      .then(value => { setStatus(value); setError(""); })
      .catch(reason => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Unable to load Alexa connection state."); });
    return () => controller.abort();
  }, []);
  async function disconnect() {
    setBusy(true);
    try {
      const response = await fetch("/api/integrations/alexa/status", { method: "DELETE" });
      if (!response.ok) throw new Error("Alexa could not be disconnected.");
      setStatus(previous => previous ? { ...previous, connected: false, connectedAt: null } : previous);
    } catch (reason) { setError(reason instanceof Error ? reason.message : "Alexa could not be disconnected."); }
    finally { setBusy(false); }
  }
  return (
    <Card className="border-white/10 bg-card/80 shadow-xl shadow-black/20 backdrop-blur">
      <CardHeader>
        <div className="flex items-start justify-between gap-4">
          <div className="flex gap-3"><div className="flex size-11 shrink-0 items-center justify-center rounded-2xl border border-blue-500/20 bg-blue-500/10 text-blue-400"><Link2 className="size-5" /></div><div><CardTitle className="text-white">Amazon Alexa</CardTitle><CardDescription>Control authorized lights and fans through the Nexora Smart Home skill.</CardDescription></div></div>
          {status ? <Badge variant="outline" className={status.connected ? "border-green-500/20 bg-green-500/10 text-green-400" : "border-white/10 text-muted-foreground"}>{status.connected ? "Connected" : "Not connected"}</Badge> : <LoaderCircle className="size-5 animate-spin text-muted-foreground" />}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {error && <p className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-300">{error}</p>}
        <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4 text-sm text-muted-foreground"><p className="font-medium text-white">Available capabilities</p><p className="mt-2">{status?.capabilities.join(" · ") || "Power control · Device state · Connectivity health"}</p></div>
        <p className="text-sm leading-6 text-muted-foreground">To connect, open the Alexa app, enable <span className="text-white">Nexora Smart Home</span>, and sign in to Nexora when prompted. Gates and security controls are not shared with Alexa.</p>
        {status?.connected && <div className="flex items-center justify-between gap-4"><p className="text-xs text-muted-foreground">Connected {status.connectedAt ? new Date(status.connectedAt).toLocaleDateString() : "to this account"}</p><Button variant="outline" disabled={busy} onClick={disconnect} className="border-red-500/20 text-red-300 hover:bg-red-500/10"><Unplug className="size-4" />Disconnect</Button></div>}
      </CardContent>
    </Card>
  );
}
