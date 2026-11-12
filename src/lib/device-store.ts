import type {
  Device,
  DeviceCommand,
  DeviceCommandType,
  DeviceId,
  DeviceState,
} from "../domain/smart-estate.ts";
import { applyCommand, validateCommand } from "./device-capabilities.ts";
import { MockDeviceSimulator, type DeviceSimulator } from "./simulation/device-simulator.ts";

export interface DeviceStoreSnapshot {
  devices: Device[];
  states: Record<DeviceId, DeviceState>;
  commands: Record<DeviceId, DeviceCommand | undefined>;
  lastError: string | null;
}

export type CommandSender = (
  deviceId: DeviceId,
  type: DeviceCommandType,
  value: number | undefined,
  clientRequestId: string,
) => Promise<DeviceCommand>;

export class DeviceStore {
  private listeners = new Set<() => void>();
  private snapshot: DeviceStoreSnapshot;
  private readonly simulator: DeviceSimulator;
  private commandSender?: CommandSender;

  constructor(
    devices: Device[],
    states: DeviceState[],
    simulator: DeviceSimulator = new MockDeviceSimulator(),
  ) {
    this.simulator = simulator;
    this.snapshot = {
      devices,
      states: Object.fromEntries(states.map((state) => [state.deviceId, state])),
      commands: {},
      lastError: null,
    };
  }

  setCommandSender(sender?: CommandSender) {
    this.commandSender = sender;
  }

  replaceInventory(devices: Device[], states: DeviceState[]) {
    this.snapshot = {
      devices,
      states: Object.fromEntries(states.map((state) => [state.deviceId, state])),
      commands: this.snapshot.commands,
      lastError: null,
    };
    this.emit();
  }

  reconcileState(state: DeviceState) {
    if (!this.snapshot.states[state.deviceId]) return;
    this.snapshot = { ...this.snapshot, states: { ...this.snapshot.states, [state.deviceId]: state } };
    this.emit();
  }

  reconcileCommand(command: DeviceCommand) {
    const state = this.snapshot.states[command.deviceId];
    if (!state) return;
    this.update(command.deviceId, command, { ...state, commandStatus: command.status });
  }

  setConnectivity(deviceId: DeviceId, connectivity: DeviceState["connectivity"]) {
    const state = this.snapshot.states[deviceId];
    if (!state) return;
    this.snapshot = { ...this.snapshot, states: { ...this.snapshot.states, [deviceId]: { ...state, connectivity } } };
    this.emit();
  }

  clearError() {
    if (!this.snapshot.lastError) return;
    this.snapshot = { ...this.snapshot, lastError: null };
    this.emit();
  }

  getSnapshot = () => this.snapshot;
  getServerSnapshot = () => this.snapshot;

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  async sendCommand(deviceId: DeviceId, type: DeviceCommandType, value?: number) {
    const device = this.snapshot.devices.find((item) => item.id === deviceId);
    const state = this.snapshot.states[deviceId];
    if (!device || !state) throw new Error("Unknown device");
    if (state.connectivity === "OFFLINE") throw new Error(`${device.name} is offline`);

    const validationError = validateCommand(device, type, value);
    if (validationError) throw new Error(validationError);

    const id = globalThis.crypto?.randomUUID?.() ?? `cmd-${Date.now()}`;
    const requestedAt = new Date().toISOString();
    const desired = applyCommand(state.reported, type, value);
    const command: DeviceCommand = {
      id,
      deviceId,
      type,
      parameters: value === undefined ? undefined : { value },
      status: "PENDING",
      requestedAt,
    };
    this.update(deviceId, command, { ...state, desired, commandStatus: "PENDING" });

    if (this.commandSender) {
      try {
        const accepted = await this.commandSender(deviceId, type, value, id);
        this.update(deviceId, accepted, {
          ...this.snapshot.states[deviceId],
          desired,
          commandStatus: accepted.status,
        });
        return accepted;
      } catch (error) {
        const message = error instanceof Error ? error.message : "Command failed";
        const current = this.snapshot.states[deviceId];
        this.snapshot = { ...this.snapshot, lastError: message };
        this.update(
          deviceId,
          { ...command, status: "FAILED", completedAt: new Date().toISOString(), error: message },
          { ...current, desired: null, commandStatus: "FAILED" },
        );
        throw error;
      }
    }

    const result = await this.simulator.execute(() => {
      const current = this.snapshot.states[deviceId];
      this.update(
        deviceId,
        { ...this.snapshot.commands[deviceId]!, status: "ACCEPTED" },
        { ...current, commandStatus: "ACCEPTED" },
      );
    });

    const current = this.snapshot.states[deviceId];
    const completedAt = new Date().toISOString();
    if (result.status === "EXECUTED") {
      this.update(
        deviceId,
        { ...this.snapshot.commands[deviceId]!, status: "EXECUTED", completedAt },
        {
          ...current,
          desired: null,
          reported: desired,
          commandStatus: "EXECUTED",
          lastReportedAt: completedAt,
        },
      );
    } else {
      this.update(
        deviceId,
        { ...this.snapshot.commands[deviceId]!, status: result.status, completedAt, error: result.error },
        { ...current, desired: null, commandStatus: result.status },
      );
    }

    return this.snapshot.commands[deviceId]!;
  }

  private update(deviceId: DeviceId, command: DeviceCommand, state: DeviceState) {
    this.snapshot = {
      ...this.snapshot,
      states: { ...this.snapshot.states, [deviceId]: state },
      commands: { ...this.snapshot.commands, [deviceId]: command },
    };
    this.listeners.forEach((listener) => listener());
  }

  private emit() {
    this.listeners.forEach((listener) => listener());
  }
}
