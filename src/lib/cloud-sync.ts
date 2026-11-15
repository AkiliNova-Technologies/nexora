const BASE_DELAY_MS = 4_000;
const MAX_DELAY_MS = 30_000;

export function cloudSyncDelay(failureCount: number, documentHidden: boolean) {
  if (documentHidden) return MAX_DELAY_MS;
  return Math.min(MAX_DELAY_MS, BASE_DELAY_MS * 2 ** Math.max(0, failureCount));
}
