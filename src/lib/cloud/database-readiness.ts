import type postgres from "postgres";

type Sql = ReturnType<typeof postgres>;

export type DatabaseReadinessStage = "query_start" | "query_complete";

export async function executeDatabaseReadiness(
  sql: Sql,
  onStage: (stage: DatabaseReadinessStage) => void = () => {},
) {
  onStage("query_start");
  const result = await sql`select 1 as ready`;
  onStage("query_complete");
  return result;
}
