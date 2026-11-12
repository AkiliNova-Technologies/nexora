import type { HouseSecurityMode } from "../domain/smart-estate.ts";

export interface SecurityModeState {
  houseId: string | null;
  value: HouseSecurityMode | null;
  loading: boolean;
  requestId: number;
}

export const emptySecurityModeState: SecurityModeState = { houseId: null, value: null, loading: false, requestId: 0 };

export function reconcileSecurityMode(current: HouseSecurityMode | null, incoming: HouseSecurityMode, houseId: string) {
  if (incoming.houseId !== houseId || (current?.houseId === houseId && incoming.version < current.version)) return current;
  return incoming;
}

export function beginSecurityModeLoad(current: SecurityModeState, houseId: string, requestId: number): SecurityModeState {
  return { houseId, value: current.houseId === houseId ? current.value : null, loading: true, requestId };
}

export function completeSecurityModeLoad(current: SecurityModeState, value: HouseSecurityMode, houseId: string, requestId: number): SecurityModeState {
  if (current.houseId !== houseId || current.requestId !== requestId || value.houseId !== houseId) return current;
  return { ...current, value: reconcileSecurityMode(current.value, value, houseId), loading: false };
}
