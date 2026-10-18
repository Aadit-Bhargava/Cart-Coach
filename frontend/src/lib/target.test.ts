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
