type TimingFields = Record<string, number | string | boolean | null>;

export function logServerTiming(event: string, fields: TimingFields) {
  console.info(JSON.stringify({ event, ...fields }));
}

export function elapsedMs(startedAt: number) {
  return Math.round(performance.now() - startedAt);
}

const identifierPattern = /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i;

export function diagnosticRoute(path: string[]) {
  return path.map((segment) => identifierPattern.test(segment) ? ":id" : segment).join("/");
}
