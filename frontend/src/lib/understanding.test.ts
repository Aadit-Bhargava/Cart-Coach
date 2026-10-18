import assert from "node:assert/strict";
import { test } from "node:test";
import { applyUnderstanding } from "./understanding.ts";

const reading = { activity: "endurance" as const, daily_protein_g: 110, basis: "1.5 g per kg of body weight, for endurance training", diet: "veg" as const, allergies: ["dairy"], likes: ["oats"] };
const saved = { diet: "vegan" as const, allergies: "peanuts, soy", likes: "paneer" };

test("the full popup takes everything from the new reading", () => {
  assert.deepEqual(applyUnderstanding("full", saved, reading), {
    activity: "endurance", daily: 110, basis: reading.basis, diet: "veg", allergies: "dairy", likes: "oats",
  });
});

test("details mode keeps the saved diet, allergies and likes", () => {
  const next = applyUnderstanding("details", saved, reading);
  assert.equal(next.diet, "vegan");
  assert.equal(next.allergies, "peanuts, soy");
  assert.equal(next.likes, "paneer");
  // ...and still takes the activity and the protein amount, which is what the popup is for.
  assert.equal(next.activity, "endurance");
  assert.equal(next.daily, 110);
  assert.equal(next.basis, reading.basis);
});
