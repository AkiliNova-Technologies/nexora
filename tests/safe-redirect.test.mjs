import assert from "node:assert/strict";
import test from "node:test";
import { safeInternalPath } from "../src/lib/safe-redirect.ts";

test("same-origin paths are preserved", () => {
  assert.equal(safeInternalPath("/settings?integration=alexa#x"), "/settings?integration=alexa#x");
  assert.equal(safeInternalPath("/oauth/authorize?client_id=a&state=b"), "/oauth/authorize?client_id=a&state=b");
});

test("open-redirect payloads fall back to the dashboard", () => {
  for (const value of [null, "", "dashboard", "https://evil.example", "//evil.example", "/\\evil.example", "/\\/evil.example", "\\\\evil.example", "/\t/evil.example", "/\n/evil.example", "javascript:alert(1)"]) {
    assert.equal(safeInternalPath(value), "/dashboard", String(value));
  }
});
