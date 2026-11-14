import postgres from "postgres";

let client: ReturnType<typeof postgres> | undefined;

export function getSql() {
  if (client) return client;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL is not configured");
  client = postgres(connectionString, {
    max: 1,
    prepare: false,
    ssl: connectionString.includes("localhost") || connectionString.includes("127.0.0.1") ? false : "require",
    connect_timeout: 10,
    idle_timeout: 20,
  });
  return client;
}
