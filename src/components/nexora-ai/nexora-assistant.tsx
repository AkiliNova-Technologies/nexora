"use client";

import * as React from "react";
import { Bot, LoaderCircle, Mic, MicOff, RotateCcw, Send, Square, Volume2, VolumeX, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDeviceStore, useDevices, useSmartEstate } from "@/components/providers/device-state-provider";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import type { DeviceCommand, DeviceState, Estate, GateResource } from "@/domain/smart-estate";
import { smartEstateApi, smartEstateMode } from "@/lib/api/client";
import {
  consumeConfirmation, createConfirmation, createContext, describeStatus, filterDevicesForQuery,
  normalizeCommand, parseCommand, permissionContextKey, resolveClarificationChoice, resolveControlCommand, shouldProcessTranscript,
} from "@/lib/nexora-ai/command-engine";
import { buildEstateKnowledge, describeCapabilities, summarizeInventory } from "@/lib/nexora-ai/estate-knowledge";
import type { AssistantMessage, AssistantPhase, ConversationContext, ResolvedCommand } from "@/lib/nexora-ai/types";

const publicRoutes = new Set(["/", "/login", "/register"]);
const mockEstate: Estate = { id: "estate-nexora-demo", name: "Nexora Estate", timezone: "Africa/Kampala" };
const mockGate: GateResource = {
  device: { id: "dev-main-entrance-gate", estateId: mockEstate.id, name: "Main Entrance Gate", type: "GATE", capabilities: [{ type: "GATE_CONTROL" }], executionMode: "SIMULATED" },
  state: { deviceId: "dev-main-entrance-gate", connectivity: "ONLINE", desired: null, reported: { simulation: true, physicalPositionVerification: "UNVERIFIED" }, commandStatus: "IDLE", lastReportedAt: new Date(0).toISOString() },
  physicalPositionVerification: "UNVERIFIED",
};

function message(kind: AssistantMessage["kind"], text: string, phase?: AssistantPhase): AssistantMessage {
  return { id: globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`, kind, text, phase, createdAt: new Date().toISOString() };
}

export function NexoraAssistant() {
  const pathname = usePathname();
  const { status, user, estates, houses, currentHouse, rooms, securityMode, securityEvents, eventStatus, error: backendError, changeSecurityMode } = useSmartEstate();
  const snapshot = useDevices();
  const store = useDeviceStore();
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const [phase, setPhase] = React.useState<AssistantPhase>("idle");
  const [messages, setMessages] = React.useState<AssistantMessage[]>([]);
  const [gate, setGate] = React.useState<GateResource | null>(smartEstateMode === "MOCK" ? mockGate : null);
  const contextRef = React.useRef<ConversationContext>(createContext(user?.id ?? "anonymous", currentHouse?.id ?? null));
  const recentTranscripts = React.useRef(new Map<string, number>());
  const observedCommands = React.useRef(new Map<string, DeviceCommand["status"]>());
  const scrollRef = React.useRef<HTMLDivElement>(null);
  const speech = useSpeechSynthesis();

  const respond = React.useCallback((text: string, nextPhase: AssistantPhase = "idle", aloud = true) => {
    setMessages((current) => [...current, message("assistant", text, nextPhase)]);
    setPhase(nextPhase);
    if (aloud) speech.speak(text);
  }, [speech]);

  const execute = React.useCallback(async (resolved: ResolvedCommand) => {
    setPhase("executing");
    setMessages((current) => [...current, message("status", `Sending ${resolved.command.toLowerCase().replaceAll("_", " ")} to ${resolved.devices.length === 1 ? resolved.devices[0].name : `${resolved.devices.length} devices`}…`, "executing")]);
    const results = await Promise.allSettled(resolved.devices.map(async (device): Promise<DeviceCommand> => {
      if (device.type !== "GATE") return store.sendCommand(device.id, resolved.command);
      return smartEstateMode === "MOCK"
        ? { id: crypto.randomUUID(), deviceId: device.id, type: resolved.command, status: "EXECUTED", requestedAt: new Date().toISOString(), completedAt: new Date().toISOString(), physicalPositionVerification: "UNVERIFIED" }
        : smartEstateApi.command(device.id, { command: resolved.command, clientRequestId: crypto.randomUUID() });
    }));
    contextRef.current.lastDeviceIds = resolved.deviceIds;
    contextRef.current.lastHouseId = resolved.houseId ?? contextRef.current.lastHouseId;
    const succeeded: string[] = [], failed: string[] = [], pending: string[] = [];
    results.forEach((result, index) => {
      const name = resolved.devices[index].name;
      if (result.status === "rejected") failed.push(`${name}: ${result.reason instanceof Error ? result.reason.message : "request failed"}`);
      else if (result.value.status === "EXECUTED") succeeded.push(name);
      else if (result.value.status === "FAILED" || result.value.status === "TIMEOUT") failed.push(`${name}: ${result.value.error ?? result.value.status.toLowerCase()}`);
      else pending.push(`${name} (${result.value.status.toLowerCase()})`);
    });
    const caveat = resolved.devices.some((device) => device.type === "GATE") ? " Gate controller acknowledgement does not verify physical position." : "";
    const summary = [succeeded.length ? `Completed: ${succeeded.join(", ")}.` : "", pending.length ? `Awaiting acknowledgement: ${pending.join(", ")}.` : "", failed.length ? `Failed: ${failed.join("; ")}.` : ""].filter(Boolean).join(" ");
    respond(`${summary}${caveat}`, failed.length ? "error" : pending.length ? "executing" : "success");
  }, [respond, store]);

  const knowledge = React.useMemo(() => buildEstateKnowledge({
    estate: gate ? mockEstate : undefined,
    houses,
    rooms,
    devices: gate ? [...snapshot.devices, gate.device] : snapshot.devices,
    states: { ...snapshot.states, ...(gate ? { [gate.device.id]: gate.state } : {}) },
    securityModes: securityMode ? [securityMode] : [],
  }), [gate, houses, rooms, securityMode, snapshot.devices, snapshot.states]);
  const permissionsKey = React.useMemo(() => permissionContextKey([...snapshot.devices, ...(gate ? [gate.device] : [])]), [gate, snapshot.devices]);

  const processCommand = React.useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setMessages((current) => [...current, message("user", trimmed)]);
    setInput(""); setPhase("processing");
    let parsed = parseCommand(trimmed);
    const context = contextRef.current;
    if (context.pendingSecurityTarget) {
      if (context.pendingSecurityTarget.expiresAt <= Date.now()) {
        context.pendingSecurityTarget = null;
      } else if (parsed.intent === "UNKNOWN") {
        const reply = normalizeCommand(trimmed);
        const selectedHouse = houses.find((house) => normalizeCommand(house.name) === reply || reply.includes(normalizeCommand(house.name)));
        if (selectedHouse) {
          parsed = { raw: trimmed, normalized: normalizeCommand(trimmed), intent: "SECURITY_CONTROL", action: context.pendingSecurityTarget.action, targetText: normalizeCommand(selectedHouse.name), group: "HOUSE" };
          context.pendingSecurityTarget = null;
        } else if (/\b(perimeter|compound|estate)\b/.test(reply) && user?.role === "ESTATE_ADMIN") {
          parsed = { raw: trimmed, normalized: normalizeCommand(trimmed), intent: "SECURITY_CONTROL", action: context.pendingSecurityTarget.action, targetText: "perimeter", group: "HOUSE" };
          context.pendingSecurityTarget = null;
        } else {
          respond(`Please name one of the authorized houses: ${houses.map((house) => house.name).join(", ")}.`);
          return;
        }
      }
    }

    if (parsed.intent === "CANCEL") {
      context.pendingConfirmation = null; context.pendingSecurityConfirmation = null; context.pendingSecurityTarget = null; context.pendingClarification = null;
      respond("Cancelled. I won't send a device command."); return;
    }
    if (parsed.intent === "CONFIRM") {
      const securityConfirmation = context.pendingSecurityConfirmation;
      context.pendingSecurityConfirmation = null;
      if (securityConfirmation) {
        if (securityConfirmation.expiresAt <= Date.now()) { respond("That security confirmation expired. Please issue the command again.", "error"); return; }
        try {
          if (securityConfirmation.scope === "ESTATE_PERIMETER") {
            if (user?.role !== "ESTATE_ADMIN" || !securityConfirmation.estateId) throw new Error("Only an estate administrator can change perimeter security.");
            const current = await smartEstateApi.estateSecurityMode(securityConfirmation.estateId);
            const result = await smartEstateApi.updateEstateSecurityMode(securityConfirmation.estateId, { mode: securityConfirmation.mode as "DISARMED" | "ARMED_AWAY", expectedVersion: current.version, clientRequestId: crypto.randomUUID() });
            respond(`Estate perimeter security is now ${result.mode.toLowerCase().replaceAll("_", " ")}.`, "success");
          } else {
            const houseIds = securityConfirmation.houseIds ?? [];
            if (!houseIds.length || houseIds.some((id) => !houses.some((house) => house.id === id))) throw new Error("The authorized house list changed. Please issue the command again.");
            const completed: string[] = [];
            const failed: string[] = [];
            for (const houseId of houseIds) {
              const house = houses.find((item) => item.id === houseId)!;
              try {
                if (house.id === currentHouse?.id && securityMode?.houseId === house.id) {
                  await changeSecurityMode(securityConfirmation.mode);
                } else {
                  const current = await smartEstateApi.securityMode(house.id);
                  await smartEstateApi.updateSecurityMode(house.id, { mode: securityConfirmation.mode, expectedVersion: current.version, clientRequestId: crypto.randomUUID() });
                }
                completed.push(house.name);
              } catch (cause) {
                failed.push(`${house.name}: ${cause instanceof Error ? cause.message : "request failed"}`);
              }
            }
            const summary = [completed.length ? `Updated: ${completed.join(", ")}.` : "", failed.length ? `Not updated: ${failed.join("; ")}.` : ""].filter(Boolean).join(" ");
            respond(summary || "No house security changes were made.", failed.length ? "error" : "success");
          }
        } catch (cause) {
          respond(cause instanceof Error ? cause.message : "The security mode could not be changed.", "error");
        }
        return;
      }
      const confirmation = consumeConfirmation(context.pendingConfirmation);
      context.pendingConfirmation = null;
      if (!confirmation) { respond("There is no active confirmation, or it has expired.", "error"); return; }
      await execute(confirmation.command); return;
    }
    if (parsed.intent === "CAPABILITIES" || parsed.intent === "HELP") { respond(describeCapabilities(knowledge, parsed.helpTopic), "idle", false); return; }
    if (parsed.intent === "ESTATE_OVERVIEW") { respond(summarizeInventory(knowledge), "idle", false); return; }
    if (parsed.intent === "UNSUPPORTED_FEATURE") {
      respond(parsed.unsupportedFeature === "TEMPERATURE" ? "Temperature control isn't available for the estate fan. I can switch an authorized fan on or off when it is connected." : "Variable fan speed is only available when the registered device and controller expose that capability.", "idle"); return;
    }
    if (parsed.intent === "SECURITY_CONTROL") {
      const isAdmin = user?.role === "ESTATE_ADMIN";
      const mode = parsed.action === "DISARM" ? "DISARMED" : "ARMED_AWAY";
      const requestsPerimeter = /\b(perimeter|compound)\b/.test(parsed.normalized);
      if (requestsPerimeter) {
        if (!isAdmin) { respond("You can manage security only for your own house. Estate perimeter security is restricted to an estate administrator.", "error"); return; }
        if (estates.length !== 1) { respond(estates.length ? "I need the estate identified before changing perimeter security." : "No authorized estate security zone is available.", "error"); return; }
        const estate = estates[0];
        context.pendingSecurityConfirmation = { scope: "ESTATE_PERIMETER", estateId: estate.id, mode, createdAt: Date.now(), expiresAt: Date.now() + 30_000 };
        respond(`Please confirm: ${mode === "DISARMED" ? "disarm" : "arm"} the ${estate.name} perimeter. This confirmation expires in 30 seconds.`, "idle", false); return;
      }

      if (parsed.group === "ESTATE") {
        if (!isAdmin) { respond("Only an estate administrator can arm or disarm multiple houses.", "error"); return; }
        if (!houses.length) { respond("No authorized houses are available for this estate.", "error"); return; }
        context.pendingSecurityConfirmation = { scope: "HOUSES", houseIds: houses.map((house) => house.id), mode, createdAt: Date.now(), expiresAt: Date.now() + 30_000 };
        respond(`Please confirm: ${mode === "DISARMED" ? "disarm" : "arm"} security for all ${houses.length} authorized houses: ${houses.map((house) => house.name).join(", ")}. This confirmation expires in 30 seconds.`, "idle", false); return;
      }

      const namedHouse = parsed.targetText
        ? houses.find((house) => normalizeCommand(house.name).includes(parsed.targetText!) || parsed.normalized.includes(normalizeCommand(house.name)))
        : undefined;
      if (parsed.targetText && !namedHouse) {
        respond("I couldn't match that house to an authorized house in your estate. Please use the house name shown in your account.", "error"); return;
      }
      const target = namedHouse ?? currentHouse ?? (houses.length === 1 ? houses[0] : null);
      if (!target && isAdmin && houses.length > 1) {
        context.pendingSecurityTarget = { action: parsed.action === "DISARM" ? "DISARM" : "ARM", createdAt: Date.now(), expiresAt: Date.now() + 5 * 60_000 };
        respond(`Which house should I ${mode === "DISARMED" ? "disarm" : "arm"}? You can choose: ${houses.map((house) => house.name).join(", ")}.`); return;
      }
      if (!target || !houses.some((house) => house.id === target.id)) { respond("No authorized house security zone is currently available.", "error"); return; }
      if (!isAdmin && target.id !== currentHouse?.id) { respond("You can arm or disarm only your own selected house.", "error"); return; }
      context.pendingSecurityConfirmation = { scope: "HOUSE", houseIds: [target.id], mode, createdAt: Date.now(), expiresAt: Date.now() + 30_000 };
      respond(`Please confirm: ${mode === "DISARMED" ? "disarm" : "arm"} ${target.name}. This confirmation expires in 30 seconds.`, "idle", false); return;
    }

    let inventory = gate ? [...snapshot.devices, gate.device] : snapshot.devices;
    let effectiveParsed = parsed;
    if (context.pendingClarification) {
      if (context.pendingClarification.expiresAt <= Date.now()) {
        context.pendingClarification = null;
      } else {
        const pending = context.pendingClarification;
        const candidateDevices = inventory.filter((device) => pending.candidateIds.includes(device.id));
        const choice = resolveClarificationChoice(trimmed, candidateDevices, rooms, houses);
        if (choice) {
          inventory = [choice];
          effectiveParsed = pending.parsed;
          context.pendingClarification = null;
        } else if (candidateDevices.length) {
          respond(`Please choose one of the available devices: ${candidateDevices.map((device, index) => `${index + 1}. ${device.name}`).join(", ")}. You can say “first”, “second”, or the device name.`);
          return;
        } else {
          context.pendingClarification = null;
        }
      }
    }

    if (effectiveParsed.intent === "CONTROL_DEVICE") {
      const resolution = resolveControlCommand(effectiveParsed, inventory, rooms, context.lastDeviceIds, currentHouse ? [currentHouse.name] : [], Object.fromEntries(houses.map((house) => [house.id, [house.name]])));
      if (resolution.kind === "ambiguous") {
        context.pendingClarification = { parsed: effectiveParsed, candidateIds: resolution.candidates.map((item) => item.id), createdAt: Date.now(), expiresAt: Date.now() + 5 * 60_000 };
        respond(`I found multiple matches: ${resolution.candidates.map((item) => item.name).join(", ")}. Which one would you like?`); return;
      }
      if (resolution.kind !== "resolved") { respond(resolution.message, resolution.kind === "not-found" ? "error" : "idle"); return; }
      if (resolution.command.command === "OPEN_GATE" || resolution.command.command === "CLOSE_GATE") {
        context.pendingConfirmation = createConfirmation(resolution.command);
        respond(`Please confirm: ${resolution.command.command === "OPEN_GATE" ? "open" : "close"} ${resolution.command.devices[0].name}. This confirmation expires in 30 seconds.`, "idle", false); return;
      }
      await execute(resolution.command); return;
    }
    if (parsed.intent === "LIST_DEVICES") {
      const devices = filterDevicesForQuery(parsed, inventory, rooms, currentHouse ? [currentHouse.name] : []);
      respond(devices.length ? `Available devices: ${devices.map((item) => item.name).join(", ")}.` : "I couldn't find devices matching that location."); return;
    }
    if (parsed.intent === "SECURITY_STATUS") {
      const sensors = snapshot.devices.filter((device) => device.type === "MOTION_SENSOR" || device.type === "CONTACT_SENSOR");
      const latest = securityEvents[0];
      respond(`${securityMode ? `${currentHouse?.name ?? "House"} security is ${securityMode.mode.toLowerCase().replaceAll("_", " ")}. ` : ""}${sensors.map((device) => describeStatus(device, snapshot.states[device.id])).join(" ") || "No authorized security sensors are available."}${latest ? ` Latest event: ${latest.type.toLowerCase().replaceAll("_", " ")} at ${new Date(latest.occurredAt).toLocaleString()}.` : ""}`); return;
    }
    if (parsed.intent === "DEVICE_STATUS") {
      const matches = filterDevicesForQuery(parsed, inventory.filter((device) => device.type === parsed.deviceType), rooms, currentHouse ? [currentHouse.name] : []);
      if (!matches.length) { respond("I couldn't find an authorized device of that type.", "error"); return; }
      const states = Object.fromEntries(Object.entries(snapshot.states)) as Record<string, DeviceState>;
      if (gate) states[gate.device.id] = gate.state;
      respond(matches.map((device) => describeStatus(device, states[device.id])).join(" ")); context.lastDeviceIds = matches.map((item) => item.id); return;
    }
    respond("I couldn't understand that command. You can ask me to control lights or fans, check status, list devices, or manage an authorized gate.", "error");
  }, [changeSecurityMode, currentHouse, estates, execute, gate, houses, knowledge, respond, rooms, securityEvents, securityMode, snapshot.devices, snapshot.states, user]);

  const recognition = useSpeechRecognition((text) => {
    if (!shouldProcessTranscript(recentTranscripts.current, text)) return;
    void processCommand(text);
  });

  React.useEffect(() => {
    contextRef.current = createContext(user?.id ?? "anonymous", currentHouse?.id ?? null);
    // A user/house boundary must synchronously discard session-only conversation data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages([]); setPhase("idle"); observedCommands.current.clear();
  }, [currentHouse?.id, permissionsKey, user?.id, user?.role]);
  React.useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" }); }, [messages, recognition.interim]);
  React.useEffect(() => {
    if (!open || smartEstateMode === "MOCK" || gate) return;
    let active = true;
    void smartEstateApi.estates().then((estates) => estates[0] ? smartEstateApi.gate(estates[0].id) : null).then((resource) => { if (active && resource) setGate(resource); }).catch(() => { /* gate is optional for house commands */ });
    return () => { active = false; };
  }, [gate, open]);
  React.useEffect(() => {
    const estateId = gate?.device.estateId;
    if (!open || smartEstateMode !== "BACKEND" || !estateId) return;
    const source = new EventSource(smartEstateApi.estateEventUrl(estateId), { withCredentials: true });
    const onState = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as { estateId?: string; state: DeviceState };
      if (payload.estateId === estateId) setGate((current) => current ? { ...current, state: payload.state } : current);
    };
    const onCommand = (event: MessageEvent<string>) => {
      const payload = JSON.parse(event.data) as { estateId?: string; command: DeviceCommand };
      if (payload.estateId !== estateId || !["EXECUTED", "FAILED", "TIMEOUT"].includes(payload.command.status)) return;
      if (observedCommands.current.get(payload.command.id) === payload.command.status) return;
      observedCommands.current.set(payload.command.id, payload.command.status);
      respond(payload.command.status === "EXECUTED" ? `${gate.device.name} acknowledged controller execution. Physical position remains unverified.` : `${gate.device.name} reported ${payload.command.status.toLowerCase()}: ${payload.command.error ?? "no acknowledgement"}.`, payload.command.status === "EXECUTED" ? "success" : "error");
    };
    source.addEventListener("device.state.changed", onState as EventListener);
    source.addEventListener("device.command.updated", onCommand as EventListener);
    return () => source.close();
  }, [gate?.device.estateId, gate?.device.name, open, respond]);
  React.useEffect(() => {
    for (const command of Object.values(snapshot.commands)) {
      if (!command) continue;
      const previous = observedCommands.current.get(command.id);
      observedCommands.current.set(command.id, command.status);
      if (previous && previous !== command.status && (command.status === "EXECUTED" || command.status === "FAILED" || command.status === "TIMEOUT")) {
        const device = snapshot.devices.find((item) => item.id === command.deviceId);
        respond(command.status === "EXECUTED" ? `${device?.name ?? "The device"} has acknowledged and completed the command.` : `${device?.name ?? "The device"} reported ${command.status.toLowerCase()}: ${command.error ?? "no acknowledgement"}.`, command.status === "EXECUTED" ? "success" : "error");
      }
    }
  }, [respond, snapshot.commands, snapshot.devices]);

  function close() { recognition.stop(); speech.cancel(); setOpen(false); setPhase("idle"); }
  function resetConversation() { recognition.stop(); speech.cancel(); setMessages([]); setInput(""); setPhase("idle"); contextRef.current = createContext(user?.id ?? "anonymous", currentHouse?.id ?? null); }
  if (status !== "authenticated" || publicRoutes.has(pathname)) return null;
  const suggestions = snapshot.devices.filter((device) => (device.type === "LIGHT" || device.type === "FAN") && (!device.allowedOperations || device.allowedOperations.includes("COMMAND"))).slice(0, 2).map((device) => `${device.type === "FAN" ? "Turn on" : "Check"} ${device.name}${device.type === "LIGHT" ? " status" : ""}`);

  return <>
    {open && <section role="dialog" aria-modal="false" aria-labelledby="nexora-ai-title" className="fixed inset-x-3 bottom-3 z-50 flex max-h-[calc(100dvh-1.5rem)] flex-col overflow-hidden rounded-3xl border border-white/10 bg-[#111827]/98 shadow-2xl shadow-black/50 backdrop-blur-xl sm:inset-auto sm:right-5 sm:bottom-24 sm:h-[min(680px,calc(100dvh-7rem))] sm:w-[410px]">
      <header className="flex items-center gap-3 border-b border-white/10 px-4 py-3.5">
        <span className="grid size-10 place-items-center rounded-2xl bg-blue-500/15 text-blue-400"><Bot className="size-5" /></span>
        <div className="min-w-0 flex-1"><h2 id="nexora-ai-title" className="font-semibold text-white">Nexora AI</h2><p className="truncate text-xs text-muted-foreground">{currentHouse?.name ?? "No house assigned"}</p><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><span className={`size-1.5 rounded-full ${backendError || phase === "error" ? "bg-red-400" : eventStatus === "reconnecting" || phase === "listening" ? "bg-amber-400" : eventStatus === "live" ? "bg-green-400" : "bg-slate-400"}`} />{backendError ? "Backend unavailable" : `${phaseLabel(recognition.listening ? "listening" : speech.speaking ? "speaking" : phase)} · ${eventStatus === "live" ? "connected" : eventStatus === "reconnecting" ? "reconnecting" : "connection unknown"}`}</p></div>
        <Button variant="ghost" size="icon-sm" aria-label="Reset conversation" title="Reset conversation" onClick={resetConversation}><RotateCcw /></Button>
        <Button variant="ghost" size="icon-sm" aria-label="Close Nexora AI" onClick={close}><X /></Button>
      </header>
      <div ref={scrollRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4" aria-live="polite">
        {messages.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm leading-6 text-white">Hello {user?.name?.split(" ")[0]}, I&apos;m Nexora AI. I can help manage authorized lighting, gate, ventilation, and security features. Ask what I can do, or give me a command.</p><div className="mt-3 flex flex-wrap gap-2">{["What can you do?", ...suggestions, "Check security status"].map((item) => <button key={item} onClick={() => void processCommand(item)} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-white/10 hover:text-white">{item}</button>)}</div></div>}
        {messages.map((item) => <div key={item.id} className={`flex ${item.kind === "user" ? "justify-end" : "justify-start"}`}><div className={`max-w-[86%] rounded-2xl px-3.5 py-2.5 text-sm leading-5 ${item.kind === "user" ? "bg-blue-500 text-white" : item.kind === "status" ? "border border-blue-500/20 bg-blue-500/10 text-blue-100" : item.phase === "error" ? "border border-red-500/20 bg-red-500/10 text-red-100" : "bg-white/[0.06] text-gray-100"}`}><p>{item.text}</p><time className="mt-1 block text-[10px] opacity-55">{new Date(item.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</time></div></div>)}
        {recognition.interim && <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 px-3.5 py-2.5 text-sm italic text-amber-100"><span className="sr-only">Partial transcript: </span>{recognition.interim}</div>}
        {(phase === "processing" || phase === "executing") && <div className="flex items-center gap-2 text-xs text-muted-foreground" role="status"><LoaderCircle className="size-3.5 animate-spin" />{phase === "processing" ? "Understanding your request…" : "Waiting for authoritative acknowledgement…"}</div>}
        {recognition.error && <p role="alert" className="text-xs text-red-300">{recognition.error}</p>}
      </div>
      <footer className="border-t border-white/10 p-3">
        {recognition.supported === false && <p className="mb-2 text-xs text-amber-300">Voice input is unavailable in this browser. Text commands still work.</p>}
        <form className="flex items-end gap-2" onSubmit={(event) => { event.preventDefault(); void processCommand(input); }}>
          <textarea value={input} onChange={(event) => setInput(event.target.value)} onKeyDown={(event)=>{if(event.key==="Enter"&&!event.shiftKey){event.preventDefault();if(input.trim()&&phase!=="processing"&&phase!=="executing")void processCommand(input);}}} rows={1} placeholder={recognition.listening ? "Listening…" : "Ask Nexora AI…"} className="max-h-28 min-h-11 flex-1 resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-sm text-white outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50" aria-label="Message Nexora AI" />
          <Button type="button" size="icon" variant={recognition.listening ? "destructive" : "outline"} disabled={recognition.supported !== true} aria-label={recognition.listening ? "Stop listening" : "Start voice input"} onClick={recognition.listening ? recognition.stop : recognition.start}>{recognition.listening ? <MicOff /> : <Mic />}</Button>
          <Button type="submit" size="icon" disabled={!input.trim() || phase === "processing" || phase === "executing"} aria-label="Send command">{phase === "processing" ? <LoaderCircle className="animate-spin" /> : <Send />}</Button>
        </form>
        <div className="mt-2 flex items-center gap-4"><button type="button" onClick={() => { speech.cancel(); speech.setEnabled(!speech.enabled); }} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white">{speech.enabled ? <Volume2 className="size-3.5" /> : <VolumeX className="size-3.5" />}{speech.enabled ? "Voice responses on" : "Voice responses off"}</button>{speech.speaking&&<button type="button" onClick={speech.cancel} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-white"><Square className="size-3"/>Stop speaking</button>}</div>
      </footer>
    </section>}
    {!open && <Tooltip><TooltipTrigger asChild><Button onClick={() => setOpen(true)} aria-label="Open Nexora AI" className="fixed right-4 bottom-4 z-40 size-14 rounded-full bg-blue-500 text-white shadow-xl shadow-blue-950/50 hover:bg-blue-400 sm:right-6 sm:bottom-6"><Bot className="size-6" /></Button></TooltipTrigger><TooltipContent side="left">Open Nexora AI</TooltipContent></Tooltip>}
  </>;
}

function phaseLabel(phase: AssistantPhase) {
  return ({ idle: "Ready", listening: "Listening", processing: "Understanding", executing: "Waiting for device", speaking: "Speaking", success: "Completed", error: "Needs attention" })[phase];
}
