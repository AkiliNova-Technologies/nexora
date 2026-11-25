"use client";

import * as React from "react";
import { Bot, LoaderCircle, Mic, MicOff, RotateCcw, Send, Square, Volume2, VolumeX, X } from "lucide-react";
import { usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { useDeviceStore, useDevices, useSmartEstate } from "@/components/providers/device-state-provider";
import { useSpeechRecognition } from "@/hooks/use-speech-recognition";
import { useSpeechSynthesis } from "@/hooks/use-speech-synthesis";
import type { Device, DeviceCommand, DeviceState, Estate, GateResource, SecurityEvent } from "@/domain/smart-estate";
import type { AdminOverviewResponse } from "@/lib/api/contracts";
import { toDevice, toState } from "@/components/admin/admin-device-grid";
import { answerActivity, matchRoutine, splitSteps, type ActivityCommand, type ActivityData, type ActivityEvent } from "@/lib/nexora-ai/planner";
import { smartEstateApi, smartEstateMode } from "@/lib/api/client";
import {
  consumeConfirmation, createConfirmation, createContext, describeStatus, filterDevicesForQuery,
  normalizeCommand, parseCommand, permissionContextKey, DEFAULT_SIREN_SECONDS, resolveClarificationChoice, resolveControlCommand, shouldProcessTranscript,
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

const TERMINAL_STATUSES = ["EXECUTED", "FAILED", "TIMEOUT"];

/** Combine the house and (for administrators) estate history into the planner's neutral shape. */
function activityData(input: { overview: AdminOverviewResponse | null; houseEvents: SecurityEvent[]; commands: DeviceCommand[]; devices: Device[]; states: Record<string, DeviceState>; houses: Array<{ id: string; name: string }>; isAdmin: boolean }): ActivityData {
  const zoneOf = (metadata?: Record<string, unknown> | null) => (typeof metadata?.zone === "string" ? metadata.zone : null);
  const events = new Map<string, ActivityEvent>();
  for (const event of input.houseEvents) events.set(event.id, { type: event.type, severity: event.severity, occurredAt: event.occurredAt, deviceId: event.deviceId, houseId: event.houseId, zone: zoneOf(event.metadata) });
  for (const event of input.overview?.securityEvents ?? []) if (event.occurredAt) events.set(event.id, { type: event.type, severity: event.severity, occurredAt: event.occurredAt, deviceId: event.deviceId, houseId: event.houseId, zone: zoneOf(event.metadata) });
  const estateCommands = input.overview?.commands ?? [];
  const commands: ActivityCommand[] = [
    ...estateCommands.map((item) => ({ deviceId: item.deviceId, deviceName: item.deviceName, type: item.type, status: item.status, requestedAt: item.requestedAt, requestedByName: item.requestedByName })),
    ...input.commands.filter((item) => !estateCommands.some((other) => other.id === item.id)).map((item) => ({ deviceId: item.deviceId, type: item.type, status: item.status, requestedAt: item.requestedAt })),
  ];
  return {
    now: Date.now(),
    events: [...events.values()],
    commands,
    devices: input.devices.map((device) => ({ id: device.id, name: device.name, houseId: device.houseId, type: device.type })),
    states: input.states,
    houses: input.houses,
    controllers: input.isAdmin && input.overview ? input.overview.controllers.map((controller) => ({ name: controller.name, networkState: controller.networkState, lastHeartbeatAt: controller.lastHeartbeatAt })) : undefined,
  };
}

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

  // True while an already-approved routine runs, so its steps don't print "Please confirm" prompts.
  const routineApproved = React.useRef(false);
  const respond = React.useCallback((text: string, nextPhase: AssistantPhase = "idle", aloud = true) => {
    if (routineApproved.current && text.startsWith("Please confirm:")) return;
    setMessages((current) => [...current, message("assistant", text, nextPhase)]);
    setPhase(nextPhase);
    if (aloud) speech.speak(text);
  }, [speech]);

  const isAdmin = user?.role === "ESTATE_ADMIN";
  // Estate administrators can reach every house and shared device, not only the selected house.
  const [estateData, setEstateData] = React.useState<AdminOverviewResponse | null>(null);
  const refreshEstate = React.useCallback(async () => {
    if (!isAdmin || smartEstateMode === "MOCK") return null;
    const value = await smartEstateApi.adminOverview(estates[0]?.id);
    setEstateData(value);
    return value;
  }, [estates, isAdmin]);
  const estateDevices = React.useMemo(() => (estateData?.devices ?? []).map(toDevice), [estateData]);
  const allDevices = React.useMemo(() => {
    const seen = new Set<string>();
    return [...snapshot.devices, ...(gate ? [gate.device] : []), ...estateDevices].filter((device) => !seen.has(device.id) && Boolean(seen.add(device.id)));
  }, [estateDevices, gate, snapshot.devices]);
  const allStates = React.useMemo(() => ({
    ...Object.fromEntries((estateData?.devices ?? []).map((device) => [device.id, toState(device)])),
    ...(gate ? { [gate.device.id]: gate.state } : {}),
    ...snapshot.states,
  }) as Record<string, DeviceState>, [estateData, gate, snapshot.states]);
  const assistantHouses = React.useMemo(() => {
    const byId = new Map(houses.map((house) => [house.id, { id: house.id, name: house.name }]));
    for (const house of estateData?.houses ?? []) if (!byId.has(house.id)) byId.set(house.id, { id: house.id, name: house.name });
    return [...byId.values()];
  }, [estateData, houses]);

  /** Commands sent straight to the API are followed until the controller confirms them. */
  const followUp = React.useCallback((submitted: DeviceCommand, device: Device) => {
    if (TERMINAL_STATUSES.includes(submitted.status)) return;
    void (async () => {
      let result = submitted;
      const deadline = Date.now() + 30_000;
      while (!TERMINAL_STATUSES.includes(result.status) && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 1500));
        try { result = await smartEstateApi.commandStatus(submitted.id); } catch { break; }
      }
      if (observedCommands.current.get(result.id) === result.status) return;
      observedCommands.current.set(result.id, result.status);
      const gateNote = device.type === "GATE" ? " Physical gate position remains unverified." : "";
      if (result.status === "EXECUTED") respond(`${device.name} confirmed the command.${gateNote}`, "success");
      else if (result.status === "FAILED" || result.status === "TIMEOUT") respond(`${device.name} reported ${result.status.toLowerCase()}: ${result.error ?? "no acknowledgement"}.`, "error");
      else respond(`${device.name} hasn't confirmed the command yet. Check the device before trying again.`, "error");
      void refreshEstate().catch(() => undefined);
    })();
  }, [refreshEstate, respond]);

  const execute = React.useCallback(async (resolved: ResolvedCommand) => {
    setPhase("executing");
    setMessages((current) => [...current, message("status", `Sending ${resolved.command.toLowerCase().replaceAll("_", " ")} to ${resolved.devices.length === 1 ? resolved.devices[0].name : `${resolved.devices.length} devices`}…`, "executing")]);
    const results = await Promise.allSettled(resolved.devices.map(async (device): Promise<DeviceCommand> => {
      // House devices in the live store keep their optimistic updates; everything else goes to the API.
      const inStore = snapshot.devices.some((item) => item.id === device.id);
      const valueOnly = !resolved.parameters || Object.keys(resolved.parameters).every((key) => key === "value");
      if (inStore && valueOnly && device.type !== "GATE") return store.sendCommand(device.id, resolved.command, resolved.parameters?.value);
      if (smartEstateMode === "MOCK") return { id: crypto.randomUUID(), deviceId: device.id, type: resolved.command, status: "EXECUTED", requestedAt: new Date().toISOString(), completedAt: new Date().toISOString(), physicalPositionVerification: device.type === "GATE" ? "UNVERIFIED" : null };
      const submitted = await smartEstateApi.command(device.id, { command: resolved.command, parameters: resolved.parameters, clientRequestId: crypto.randomUUID() });
      followUp(submitted, device);
      return submitted;
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
  }, [followUp, respond, snapshot.devices, store]);

  const knowledge = React.useMemo(() => buildEstateKnowledge({
    estate: gate ? mockEstate : undefined,
    houses,
    rooms,
    devices: allDevices,
    states: allStates,
    securityModes: securityMode ? [securityMode] : [],
  }), [allDevices, allStates, gate, houses, rooms, securityMode]);
  const permissionsKey = React.useMemo(() => permissionContextKey([...snapshot.devices, ...(gate ? [gate.device] : [])]), [gate, snapshot.devices]);
  const scopeContextKey = React.useMemo(() => `${user?.role ?? "anonymous"}:${houses.map((house) => house.id).toSorted().join(",")}:${estates.map((estate) => estate.id).toSorted().join(",")}`, [estates, houses, user?.role]);

  /** Handle one request. Multi-step requests and routines call this once per step. */
  const processSingle = React.useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setPhase("processing");
    let parsed = parseCommand(trimmed);
    const context = contextRef.current;
    if (context.pendingSecurityTarget) {
      if (context.pendingSecurityTarget.expiresAt <= Date.now()) {
        context.pendingSecurityTarget = null;
      } else if (parsed.intent === "UNKNOWN") {
        const reply = normalizeCommand(trimmed);
        const houseOrdinal = reply.match(/\b(first|second|third|1st|2nd|3rd|one|two|three|1|2|3)\b/);
        const houseIndex = houseOrdinal ? ({ first: 0, "1st": 0, one: 0, "1": 0, second: 1, "2nd": 1, two: 1, "2": 1, third: 2, "3rd": 2, three: 2, "3": 2 } as Record<string, number>)[houseOrdinal[1]] : undefined;
        const selectedHouse = houses.find((house) => normalizeCommand(house.name) === reply || reply.includes(normalizeCommand(house.name))) ?? (houseIndex === undefined ? undefined : houses[houseIndex]);
        if (selectedHouse) {
          parsed = { raw: trimmed, normalized: normalizeCommand(trimmed), intent: "SECURITY_CONTROL", action: context.pendingSecurityTarget.action, targetText: normalizeCommand(selectedHouse.name), group: "HOUSE" };
          context.pendingSecurityTarget = null;
        } else if (/\b(perimeter|compound|estate)\b/.test(reply) && user?.role === "ESTATE_ADMIN") {
          parsed = { raw: trimmed, normalized: normalizeCommand(trimmed), intent: "SECURITY_CONTROL", action: context.pendingSecurityTarget.action, targetText: "perimeter", group: "HOUSE" };
          context.pendingSecurityTarget = null;
        } else {
          respond("Please name one of the authorized houses: " + houses.map((house) => house.name).join(", ") + ".");
          return;
        }
      } else if (parsed.intent !== "CONFIRM" && parsed.intent !== "CANCEL") {
        context.pendingSecurityTarget = null;
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
      if (!confirmation) {
        if (context.pendingClarification && context.pendingClarification.expiresAt > Date.now()) {
          const choices = allDevices.filter((device) => context.pendingClarification?.candidateIds.includes(device.id));
          respond(`I still need you to choose a device: ${choices.map((device, index) => `${index + 1}. ${device.name}`).join(", ")}.`);
          return;
        }
        if (context.pendingSecurityTarget) {
          respond(`Please name one of the authorized houses: ${houses.map((house) => house.name).join(", ")}.`);
          return;
        }
        respond("There is no active confirmation, or it has expired.", "error"); return;
      }
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
        try { await smartEstateApi.adminOverview(estate.id); }
        catch { respond("You do not have administrator authority for this estate perimeter.", "error"); return; }
        context.pendingSecurityConfirmation = { scope: "ESTATE_PERIMETER", estateId: estate.id, mode, createdAt: Date.now(), expiresAt: Date.now() + 30_000 };
        respond(`Please confirm: ${mode === "DISARMED" ? "disarm" : "arm"} the ${estate.name} perimeter. This confirmation expires in 30 seconds.`, "idle", false); return;
      }

      if (parsed.group === "ESTATE") {
        if (!isAdmin) { respond("Only an estate administrator can arm or disarm multiple houses.", "error"); return; }
        if (estates.length !== 1) { respond("Please target one house at a time when your account has access to multiple estates.", "error"); return; }
        let administeredHouseIds = new Set<string>();
        try {
          const overview = await smartEstateApi.adminOverview(estates[0].id);
          administeredHouseIds = new Set(overview.houses.map((house) => house.id));
        } catch {
          respond("I couldn't verify administrator scope for this estate. No security changes were made.", "error"); return;
        }
        const managedHouses = houses.filter((house) => administeredHouseIds.has(house.id));
        if (!managedHouses.length) { respond("No administrator-managed houses are available in this estate.", "error"); return; }
        context.pendingSecurityConfirmation = { scope: "HOUSES", houseIds: managedHouses.map((house) => house.id), mode, createdAt: Date.now(), expiresAt: Date.now() + 30_000 };
        respond(`Please confirm: ${mode === "DISARMED" ? "disarm" : "arm"} security for all ${managedHouses.length} houses in ${estates[0].name}: ${managedHouses.map((house) => house.name).join(", ")}. This confirmation expires in 30 seconds.`, "idle", false); return;
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

    let inventory = allDevices;
    let effectiveParsed = parsed;
    if (context.pendingClarification) {
      if (context.pendingClarification.expiresAt <= Date.now()) {
        context.pendingClarification = null;
      } else if (effectiveParsed.intent !== "UNKNOWN") {
        context.pendingClarification = null;
      } else {
        const pending = context.pendingClarification;
        const candidateDevices = inventory.filter((device) => pending.candidateIds.includes(device.id));
        const choice = resolveClarificationChoice(trimmed, candidateDevices, rooms, assistantHouses);
        if (choice) {
          inventory = [choice];
          effectiveParsed = pending.parsed;
          context.pendingClarification = null;
        } else if (candidateDevices.length) {
          respond("Please choose one of the available devices: " + candidateDevices.map((device, index) => (index + 1) + ". " + device.name).join(", ") + ". You can say “first”, “second”, or the device name.");
          return;
        } else {
          context.pendingClarification = null;
        }
      }
    }

    if (effectiveParsed.intent === "CONTROL_DEVICE") {
      const resolution = resolveControlCommand(effectiveParsed, inventory, rooms, context.lastDeviceIds, currentHouse ? [currentHouse.name] : [], Object.fromEntries(assistantHouses.map((house) => [house.id, [house.name]])), { preferHouseId: currentHouse?.id, scopeHouseId: currentHouse?.id });
      if (resolution.kind === "ambiguous") {
        context.pendingClarification = { parsed: effectiveParsed, candidateIds: resolution.candidates.map((item) => item.id), createdAt: Date.now(), expiresAt: Date.now() + 5 * 60_000 };
        respond(`I found multiple matches: ${resolution.candidates.map((item) => item.name).join(", ")}. Which one would you like?`); return;
      }
      if (resolution.kind !== "resolved") { respond(resolution.message, resolution.kind === "not-found" ? "error" : "idle"); return; }
      if (resolution.command.command === "OPEN_GATE" || resolution.command.command === "CLOSE_GATE") {
        context.pendingConfirmation = createConfirmation(resolution.command);
        respond(`Please confirm: ${resolution.command.command === "OPEN_GATE" ? "open" : "close"} ${resolution.command.devices[0].name}. This confirmation expires in 30 seconds.`, "idle", false); return;
      }
      if (resolution.command.command === "ACTIVATE_SIREN") {
        context.pendingConfirmation = createConfirmation(resolution.command);
        respond(`Please confirm: sound ${resolution.command.devices[0].name} for ${resolution.command.parameters?.durationSeconds ?? DEFAULT_SIREN_SECONDS} seconds. This confirmation expires in 30 seconds.`, "idle", false); return;
      }
      await execute(resolution.command); return;
    }
    if (parsed.intent === "ACTIVITY" && parsed.activity) {
      const overview = isAdmin ? await refreshEstate().catch(() => estateData) : null;
      if (parsed.activity.kind === "CONTROLLER_STATUS" && isAdmin && !overview) { respond("I couldn't load controller details right now. Please try again in a moment.", "error"); return; }
      let houseEvents: SecurityEvent[] = securityEvents;
      if (currentHouse && smartEstateMode !== "MOCK") {
        try { houseEvents = (await smartEstateApi.securityEventPage(currentHouse.id, 0, 50)).items; } catch { /* fall back to the recent events already loaded */ }
      }
      const commands = Object.values(snapshot.commands).filter((item): item is DeviceCommand => Boolean(item));
      respond(answerActivity(parsed.activity, parsed.normalized, activityData({ overview, houseEvents, commands, devices: allDevices, states: allStates, houses: assistantHouses, isAdmin })));
      return;
    }
    if (parsed.intent === "LIST_DEVICES") {
      const devices = filterDevicesForQuery(parsed, inventory, rooms, currentHouse ? [currentHouse.name] : []);
      respond(devices.length ? `Available devices: ${devices.map((item) => item.name).join(", ")}.` : "I couldn't find devices matching that location."); return;
    }
    if (parsed.intent === "SECURITY_STATUS") {
      const sensors = allDevices.filter((device) => device.type === "MOTION_SENSOR" || device.type === "CONTACT_SENSOR" || device.type === "ULTRASONIC_SENSOR");
      const latest = securityEvents[0];
      respond(`${securityMode ? `${currentHouse?.name ?? "House"} security is ${securityMode.mode.toLowerCase().replaceAll("_", " ")}. ` : ""}${sensors.map((device) => describeStatus(device, allStates[device.id])).join(" ") || "No authorized security sensors are available."}${latest ? ` Latest event: ${latest.type.toLowerCase().replaceAll("_", " ")} at ${new Date(latest.occurredAt).toLocaleString()}.` : ""}`); return;
    }
    if (parsed.intent === "DEVICE_STATUS") {
      const family: string[] = parsed.deviceType === "LIGHT" ? ["LIGHT", "RGB_LIGHT"] : [parsed.deviceType ?? ""];
      const matches = filterDevicesForQuery(parsed, inventory.filter((device) => family.includes(device.type)), rooms, currentHouse ? [currentHouse.name] : []);
      if (!matches.length) { respond("I couldn't find an authorized device of that type.", "error"); return; }
      respond(matches.map((device) => describeStatus(device, allStates[device.id])).join(" ")); context.lastDeviceIds = matches.map((item) => item.id); return;
    }
    respond("I didn't understand that. Try “turn off the kitchen light”, “make the perimeter strip blue”, “goodnight”, or “what happened today?”. Say “give me examples” for more.", "error");
  }, [allDevices, allStates, assistantHouses, changeSecurityMode, currentHouse, estateData, estates, execute, houses, isAdmin, knowledge, refreshEstate, respond, rooms, securityEvents, securityMode, snapshot.commands, user]);

  const isWaiting = React.useCallback(() => {
    const context = contextRef.current;
    return Boolean(context.pendingConfirmation || context.pendingSecurityConfirmation || context.pendingClarification || context.pendingSecurityTarget);
  }, []);

  /** Run steps in order; stop and remember the rest if one needs a confirmation or a choice. */
  const runSteps = React.useCallback(async (steps: string[], preConfirmed: boolean) => {
    for (let index = 0; index < steps.length; index++) {
      if (steps.length > 1) setMessages((current) => [...current, message("status", `Step ${index + 1} of ${steps.length}: ${steps[index]}`)]);
      routineApproved.current = preConfirmed;
      try {
        await processSingle(steps[index]);
        // The user already approved the routine's plan, so its steps don't ask again.
        if (preConfirmed && (contextRef.current.pendingConfirmation || contextRef.current.pendingSecurityConfirmation)) await processSingle("yes");
      } finally {
        routineApproved.current = false;
      }
      if (isWaiting()) {
        contextRef.current.queuedSteps = steps.slice(index + 1);
        contextRef.current.queuedPreConfirmed = preConfirmed;
        return;
      }
    }
    contextRef.current.queuedSteps = [];
  }, [isWaiting, processSingle]);

  const processCommand = React.useCallback(async (raw: string) => {
    const trimmed = raw.trim();
    if (!trimmed) return;
    setMessages((current) => [...current, message("user", trimmed)]);
    setInput("");
    const context = contextRef.current;
    const parsed = parseCommand(trimmed);

    if (context.pendingRoutine) {
      const routine = context.pendingRoutine;
      context.pendingRoutine = null;
      if (parsed.intent === "CONFIRM" && routine.expiresAt > Date.now()) { respond(`Running ${routine.name}.`, "executing", false); await runSteps(routine.steps, true); return; }
      if (parsed.intent === "CONFIRM") { respond("That routine confirmation expired. Please ask again.", "error"); return; }
      if (parsed.intent === "CANCEL") { respond(`Cancelled the ${routine.name} routine. Nothing was changed.`); return; }
    }

    const routine = matchRoutine(parsed.normalized, {
      houseName: currentHouse?.name,
      isAdmin,
      houseDeviceTypes: new Set(allDevices.filter((device) => device.houseId === currentHouse?.id && (!device.allowedOperations || device.allowedOperations.includes("COMMAND"))).map((device) => device.type)),
      hasPerimeterStrip: allDevices.some((device) => device.type === "RGB_LIGHT" && !device.houseId),
      hasGate: allDevices.some((device) => device.type === "GATE"),
    });
    // A new request (rather than an answer such as "yes", "no", "the second one") abandons
    // any unfinished steps, so they can never run later by surprise.
    const isAnswer = parsed.intent === "CONFIRM" || parsed.intent === "CANCEL" || (parsed.intent === "UNKNOWN" && !routine);
    if (!isAnswer) {
      context.queuedSteps = [];
      context.pendingClarification = null;
      context.pendingSecurityTarget = null;
    }

    // An answer to an outstanding confirmation or choice, then any remaining steps.
    if (isAnswer && isWaiting()) {
      if (parsed.intent === "CANCEL") context.queuedSteps = [];
      await processSingle(trimmed);
      if (!isWaiting() && context.queuedSteps?.length) {
        const rest = context.queuedSteps;
        context.queuedSteps = [];
        await runSteps(rest, Boolean(context.queuedPreConfirmed));
      }
      return;
    }

    if (routine?.steps.length) {
      context.pendingRoutine = { ...routine, createdAt: Date.now(), expiresAt: Date.now() + 30_000 };
      respond(`${routine.name} routine: ${routine.steps.map((step, index) => `${index + 1}) ${step}`).join(", ")}. Say yes to run it or no to cancel. This expires in 30 seconds.`, "idle", false);
      return;
    }
    await runSteps(splitSteps(trimmed), false);
  }, [allDevices, currentHouse?.id, currentHouse?.name, isAdmin, isWaiting, processSingle, respond, runSteps]);

  const recognition = useSpeechRecognition((text) => {
    if (!shouldProcessTranscript(recentTranscripts.current, text)) return;
    void processCommand(text);
  });

  React.useEffect(() => {
    contextRef.current = createContext(user?.id ?? "anonymous", currentHouse?.id ?? null);
    // A user/house boundary must synchronously discard session-only conversation data.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMessages([]); setPhase("idle"); observedCommands.current.clear();
  }, [currentHouse?.id, permissionsKey, scopeContextKey, user?.id, user?.role]);
  React.useEffect(() => {
    if (!open || !isAdmin || smartEstateMode === "MOCK") return;
    const load = () => { if (document.visibilityState === "visible") void refreshEstate().catch(() => undefined); };
    load();
    const timer = window.setInterval(load, 15_000);
    return () => window.clearInterval(timer);
  }, [isAdmin, open, refreshEstate]);
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
        {messages.length === 0 && <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"><p className="text-sm leading-6 text-white">Hello {user?.name?.split(" ")[0]}, I&apos;m Nexora AI. I can help manage authorized lighting, gate, ventilation, and security features. Ask what I can do, or give me a command.</p><div className="mt-3 flex flex-wrap gap-2">{["What can you do?", ...suggestions, "What happened today?", "Goodnight"].map((item) => <button key={item} onClick={() => void processCommand(item)} className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-left text-xs text-muted-foreground hover:bg-white/10 hover:text-white">{item}</button>)}</div></div>}
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
