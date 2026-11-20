import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

const migration = await readFile(new URL("../supabase/migrations/20261120033213_estate_admin_big_fan_authorization.sql", import.meta.url), "utf8");
const repository = await readFile(new URL("../src/lib/cloud/repository.ts", import.meta.url), "utf8");
const alexa = await readFile(new URL("../src/lib/alexa/service.ts", import.meta.url), "utf8");

test("estate administrators inherit house access while ordinary homeowners do not", () => {
  for (const fn of ["can_view_house", "can_control_house", "can_manage_house_security"]) assert.match(migration,new RegExp(`create or replace function smart_estate\\.${fn}`));
  assert.match(migration,/join smart_estate\.estate_admin/);
  assert.match(repository,/where smart_estate\.can_view_house/);
});

test("estate fan control is administrator-only and Alexa remains house-scoped", () => {
  assert.match(migration,/select smart_estate\.is_estate_admin\(subject,target_estate\)/);
  assert.doesNotMatch(migration,/device_type='FAN'.*estate_member/);
  assert.match(alexa,/d\.house_id is not null/);
});
