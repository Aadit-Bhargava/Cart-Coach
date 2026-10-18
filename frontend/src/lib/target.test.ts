import assert from "node:assert/strict";
import { test } from "node:test";
import { cartTarget, dailyProtein, detailsComplete, parseDecimal, resolveDaily } from "./target.ts";

const stats = (ageYears: number, weightKg: number, heightCm: number) => ({ ageYears, weightKg, heightCm });

test("worked examples match the Go rule", () => {
  assert.equal(dailyProtein(stats(30, 72, 175), "endurance").grams, 110);
  assert.equal(dailyProtein(stats(30, 72, 175), "endurance").basis, "1.5 g per kg of body weight, for endurance training");
  assert.equal(dailyProtein(stats(40, 120, 170), "general").grams, 75);
  assert.equal(dailyProtein(stats(70, 60, 165), "general").grams, 60);
  assert.equal(dailyProtein(stats(25, 50, 160), "general").grams, 40);
});

test("each activity factor", () => {
  const s = stats(30, 80, 180);
  assert.equal(dailyProtein(s, "general").grams, 65);
  assert.equal(dailyProtein(s, "active").grams, 95);
  assert.equal(dailyProtein(s, "endurance").grams, 120);
  assert.equal(dailyProtein(s, "strength").grams, 130);
});

test("general activity rises to 1.0 g per kg from age 65", () => {
  assert.equal(dailyProtein(stats(64, 70, 175), "general").grams, 55);
  assert.equal(dailyProtein(stats(65, 70, 175), "general").grams, 70);
});

test("extreme bodies stay inside 40 to 220 g", () => {
  assert.equal(dailyProtein(stats(30, 250, 160), "strength").grams, 220);
  assert.equal(dailyProtein(stats(25, 30, 160), "general").grams, 40);
});

test("a stated amount overrides the rule only inside 40 to 220 g", () => {
  const s = stats(30, 72, 175);
  assert.deepEqual(resolveDaily(s, "endurance", 140), { grams: 140, basis: "the amount you gave" });
  assert.equal(resolveDaily(s, "endurance", 220).grams, 220);
  const rule = dailyProtein(s, "endurance");
  for (const stated of [0, 39, 3000, -5]) assert.deepEqual(resolveDaily(s, "endurance", stated), rule);
});

test("cart target is the daily amount for each day", () => {
  assert.equal(cartTarget(110, 3), 330);
  assert.equal(cartTarget(40, 1), 40);
  assert.equal(cartTarget(220, 7), 1540);
});

test("parseDecimal accepts a comma and rejects junk", () => {
  assert.equal(parseDecimal("72,5"), 72.5);
  assert.equal(parseDecimal(" 72.5 "), 72.5);
  assert.equal(parseDecimal("72"), 72);
  for (const bad of ["", "   ", "abc", "Infinity", "1e999", "-5", "7 2", "72.5.1"]) assert.equal(parseDecimal(bad), null, bad);
});

test("detailsComplete is false for a legacy profile and true for a full one", () => {
  const full = { age_years: 30, weight_kg: 72, height_cm: 175, activity: "endurance", days: 3, daily_protein_g: 110 };
  assert.equal(detailsComplete(full), true);
  assert.equal(detailsComplete({ age_years: null, weight_kg: null, height_cm: null, activity: "", days: 0, daily_protein_g: 0 }), false);
  assert.equal(detailsComplete({ ...full, age_years: null }), false);
  assert.equal(detailsComplete({ ...full, activity: "" }), false);
  assert.equal(detailsComplete({ ...full, days: 0 }), false);
  assert.equal(detailsComplete({ ...full, daily_protein_g: 0 }), false);
});

test("readStats turns the three form fields into numbers or one plain message", async () => {
  const { readStats } = await import("./target.ts");
  assert.deepEqual(readStats("30", "72,5", "175"), { ok: true, stats: { age_years: 30, weight_kg: 72.5, height_cm: 175 } });
  assert.deepEqual(readStats(" 18 ", "30", "120"), { ok: true, stats: { age_years: 18, weight_kg: 30, height_cm: 120 } });

  const ageMsg = "Enter your age (18 to 100).";
  const weightMsg = "Enter your weight in kg (30 to 250).";
  const heightMsg = "Enter your height in cm (120 to 230).";
  for (const age of ["", "abc", "17", "101", "30.5", "-30", "1e2"]) assert.deepEqual(readStats(age, "72", "175"), { ok: false, error: ageMsg }, `age ${age}`);
  for (const w of ["", "abc", "29.9", "250.1", "Infinity", "0"]) assert.deepEqual(readStats("30", w, "175"), { ok: false, error: weightMsg }, `weight ${w}`);
  for (const h of ["", "abc", "119.9", "230.1", "1e999"]) assert.deepEqual(readStats("30", "72", h), { ok: false, error: heightMsg }, `height ${h}`);
  // The first problem wins, in the order age, weight, height.
  assert.deepEqual(readStats("5", "5", "5"), { ok: false, error: ageMsg });
});
