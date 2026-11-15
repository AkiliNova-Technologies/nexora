import test from "node:test";
import assert from "node:assert/strict";
import { diagnosticRoute } from "../src/lib/cloud/timing.ts";

test("server timing diagnostics redact resource identifiers", () => {
  assert.equal(
    diagnosticRoute(["houses", "7d446a36-c74b-48a1-847f-72960314cc78", "rooms"]),
    "houses/:id/rooms",
  );
  assert.equal(diagnosticRoute(["me"]), "me");
});
