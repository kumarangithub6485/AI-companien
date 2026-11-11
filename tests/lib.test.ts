import { test } from "node:test";
import assert from "node:assert/strict";
import { localExtract, parseTime } from "../lib/localExtract.ts";
import { buildDays, findDrivers, fisher } from "../lib/insights.ts";
import { sampleData, SAMPLE_CHILD_ID } from "../lib/sample.ts";
import { canonicalColumn } from "../lib/types.ts";

test("parseTime", () => {
  assert.equal(parseTime("napped at 2 pm"), "14:00");
  assert.equal(parseTime("at 7:30 am"), "07:30");
  assert.equal(parseTime("in the evening"), "18:00");
  assert.equal(parseTime("ate 2 idlis"), null);
});

test("localExtract builds columns from a spoken note", () => {
  const r = localExtract("He had idli for breakfast, went to the park, napped at 2 pm for 1 hour, skipped snacks and was very aggressive in the evening");
  const get = (c: string) => r.find((x) => x.column === c);
  assert.equal(get("Breakfast")?.value, "idli");
  assert.equal(get("Outing")?.value, "park");
  assert.deepEqual(get("Nap"), { column: "Nap", value: "1 hour", time: "14:00" });
  assert.equal(get("Snacks")?.value, "no");
  assert.deepEqual(get("Aggression"), { column: "Aggression", value: "severe", time: "18:00" });
});

test("not aggressive is recorded as none", () => {
  assert.equal(localExtract("she was not aggressive today")[0].value, "none");
});

test("canonicalColumn reuses existing names", () => {
  assert.equal(canonicalColumn("night  sleep", ["Night sleep"]), "Night sleep");
  assert.equal(canonicalColumn("therapy", []), "Therapy");
});

test("drivers recover the factors planted in the sample data", () => {
  const { entries } = sampleData("2026-11-11");
  const days = buildDays(entries, SAMPLE_CHILD_ID);
  assert.ok(days.length > 70);
  const drivers = findDrivers(days);
  const top = drivers.slice(0, 3).map((d) => (d.lag ? "prev " : "") + d.label);
  assert.ok(top.includes("Nap: no"), `top drivers were ${top.join(" | ")}`);
  assert.ok(!drivers.some((d) => d.label === "Nap: yes" && !d.lag), "mirror of Nap: no is dropped");
  const nap = drivers.find((d) => d.label === "Nap: no" && !d.lag)!;
  assert.ok(nap.rateWith > nap.rateWithout + 0.2);
  for (const d of drivers) assert.ok(d.withN >= 3 && d.withoutN >= 3);
});

test("fisher exact test", () => {
  assert.ok(Math.abs(fisher(3, 1, 1, 3) - 0.4857) < 1e-3);
  assert.ok(Math.abs(fisher(2, 2, 2, 2) - 1) < 1e-9);
});

test("meal is inferred from the time of day, and short leftovers join the previous item", () => {
  assert.deepEqual(localExtract("my son morning had a dosa and itly"), [{ column: "Breakfast", value: "dosa and itly", time: "09:00" }]);
});
