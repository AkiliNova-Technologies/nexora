export function log(level: "info" | "warn" | "error", message: string, fields: Record<string, unknown> = {}) {
  process.stdout.write(`${JSON.stringify({ time: new Date().toISOString(), level, message, ...fields })}\n`);
}
