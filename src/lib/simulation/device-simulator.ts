import type { DeviceCommandStatus } from "../../domain/smart-estate.ts";

export interface SimulationResult {
  status: Extract<DeviceCommandStatus, "EXECUTED" | "FAILED" | "TIMEOUT">;
  error?: string;
}

export interface DeviceSimulator {
  execute(onAccepted: () => void): Promise<SimulationResult>;
}

export class MockDeviceSimulator implements DeviceSimulator {
  private readonly result: SimulationResult;
  private readonly delayMs: number;

  constructor(
    result: SimulationResult = { status: "EXECUTED" },
    delayMs = 250,
  ) {
    this.result = result;
    this.delayMs = delayMs;
  }

  async execute(onAccepted: () => void): Promise<SimulationResult> {
    await wait(this.delayMs);
    onAccepted();
    await wait(this.delayMs);
    return this.result;
  }
}

function wait(delayMs: number) {
  return new Promise<void>((resolve) => setTimeout(resolve, delayMs));
}
