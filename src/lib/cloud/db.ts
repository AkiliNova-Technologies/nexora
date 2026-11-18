import postgres from "postgres";

let client: ReturnType<typeof postgres> | undefined;

export const databaseTimeouts = {
  connectSeconds: 10,
  queueSeconds: 5,
  querySeconds: 8,
  cancelSeconds: 2,
} as const;

export function databaseClientOptions(connectionString: string) {
  return {
    max: 1,
    // Supabase transaction mode does not support pipelined queries. Keeping one
    // query in flight also lets queue_timeout distinguish acquisition pressure.
    max_pipeline: 1,
    prepare: false,
    ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false as const : "require" as const,
    connect_timeout: databaseTimeouts.connectSeconds,
    queue_timeout: databaseTimeouts.queueSeconds,
    // Postgres.js cancels the actual query at this deadline. If cancellation is
    // unanswered, cancel_timeout closes the connection instead of leaving it
    // and its queued work alive until the Function's platform timeout.
    query_timeout: databaseTimeouts.querySeconds,
    cancel_timeout: databaseTimeouts.cancelSeconds,
    idle_timeout: 20,
  };
}

export function getSql() {
  if (client) return client;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  client = postgres(connectionString, databaseClientOptions(connectionString));
  return client;
}
