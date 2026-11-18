import test from "node:test";
import assert from "node:assert/strict";
import net from "node:net";
import postgres from "postgres";
import { databaseClientOptions, databaseTimeouts } from "../src/lib/cloud/db.ts";
import { executeDatabaseReadiness } from "../src/lib/cloud/database-readiness.ts";

function fakeSql(execute) {
  return () => ({ then: (resolve, reject) => execute().then(resolve, reject) });
}

async function listen(server) {
  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });
  return server.address().port;
}

test("database client bounds connection queue, query and cancellation", () => {
  const options = databaseClientOptions("postgres://example.invalid/postgres");
  assert.equal(options.connect_timeout, 10);
  assert.equal(options.queue_timeout, 5);
  assert.equal(options.query_timeout, 8);
  assert.equal(options.cancel_timeout, 2);
  assert.equal(options.max, 1);
  assert.equal(options.max_pipeline, 1);
  assert.equal(options.prepare, false);
  assert.equal(options.ssl, "require");
  assert.ok(databaseTimeouts.querySeconds < 300);
});

test("database client preserves local non-TLS behavior", () => {
  assert.equal(databaseClientOptions("postgres://localhost/postgres").ssl, false);
  assert.equal(databaseClientOptions("postgres://127.0.0.1/postgres").ssl, false);
});

test("readiness reports unavailable PostgreSQL errors", async () => {
  const unavailable = Object.assign(new Error("unavailable"), { code: "ECONNREFUSED" });
  await assert.rejects(executeDatabaseReadiness(fakeSql(() => Promise.reject(unavailable))), unavailable);
});

test("readiness exposes stalled acquisition timeout errors", async () => {
  const timeout = Object.assign(new Error("queued"), { code: "QUEUE_TIMEOUT" });
  await assert.rejects(executeDatabaseReadiness(fakeSql(() => Promise.reject(timeout))), timeout);
});

test("Postgres.js bounds a socket that accepts but never completes startup", async (t) => {
  const sockets = new Set();
  const server = net.createServer((socket) => {
    sockets.add(socket);
    socket.on("close", () => sockets.delete(socket));
  });
  let port;
  try {
    port = await listen(server);
  } catch (error) {
    if (error?.code === "EPERM") {
      t.skip("local TCP listeners are disabled in this sandbox");
      return;
    }
    throw error;
  }
  const sql = postgres(`postgres://test:test@127.0.0.1:${port}/test`, {
    ssl: false,
    max: 1,
    max_pipeline: 1,
    prepare: false,
    connect_timeout: 0.2,
    queue_timeout: 0.1,
    query_timeout: 0.3,
    cancel_timeout: 0.1,
  });
  const startedAt = performance.now();
  try {
    await assert.rejects(sql`select 1`, (error) =>
      ["CONNECT_TIMEOUT", "QUERY_TIMEOUT", "QUEUE_TIMEOUT"].includes(error.code));
    assert.ok(performance.now() - startedAt < 1_500);
  } finally {
    await sql.end({ timeout: 0 });
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
});

test("readiness waits for a delayed query and records ordered stages", async () => {
  const stages = [];
  const result = await executeDatabaseReadiness(
    fakeSql(() => new Promise((resolve) => setTimeout(() => resolve([{ ready: 1 }]), 10))),
    (stage) => stages.push(stage),
  );
  assert.deepEqual(result, [{ ready: 1 }]);
  assert.deepEqual(stages, ["query_start", "query_complete"]);
});

test("readiness recovers on the next operation after a failure", async () => {
  let calls = 0;
  const sql = fakeSql(() => ++calls === 1
    ? Promise.reject(Object.assign(new Error("timed out"), { code: "QUERY_TIMEOUT" }))
    : Promise.resolve([{ ready: 1 }]));
  await assert.rejects(executeDatabaseReadiness(sql), { code: "QUERY_TIMEOUT" });
  assert.deepEqual(await executeDatabaseReadiness(sql), [{ ready: 1 }]);
});

test("concurrent readiness operations settle independently", async () => {
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const sql = fakeSql(async () => {
    await gate;
    return [{ ready: 1 }];
  });
  const operations = [executeDatabaseReadiness(sql), executeDatabaseReadiness(sql), executeDatabaseReadiness(sql)];
  release();
  const results = await Promise.all(operations);
  assert.equal(results.length, 3);
  assert.ok(results.every((rows) => rows[0].ready === 1));
});
