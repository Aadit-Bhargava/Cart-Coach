import assert from "node:assert/strict";
import { test } from "node:test";
import { allergenLabels, dietMark, isVegan } from "./diet.ts";

test("dietMark maps the three known diets and nothing else", () => {
  assert.equal(dietMark("veg"), "veg");
  assert.equal(dietMark("egg"), "egg");
  assert.equal(dietMark("non-veg"), "non-veg");
  for (const unknown of ["unknown", "", "vegan", null, undefined]) assert.equal(dietMark(unknown), null, String(unknown));
});

test("isVegan needs a veg diet and no dairy, egg or honey", () => {
  assert.equal(isVegan({ diet: "veg", allergens: [] }), true);
  assert.equal(isVegan({ diet: "veg" }), true, "missing allergens must not crash");
  assert.equal(isVegan({ diet: "veg", allergens: null }), true);
  assert.equal(isVegan({ diet: "veg", allergens: ["gluten", "peanuts"] }), true);
  for (const tag of ["dairy", "egg", "honey"]) assert.equal(isVegan({ diet: "veg", allergens: [tag] }), false, tag);
  assert.equal(isVegan({ diet: "egg", allergens: [] }), false);
  assert.equal(isVegan({ diet: "non-veg", allergens: [] }), false);
  assert.equal(isVegan({ diet: "unknown", allergens: [] }), false);
  assert.equal(isVegan({}), false);
});

test("allergenLabels gives readable names, in order, and drops tags it does not know", () => {
  assert.deepEqual(allergenLabels(["tree-nuts", "dairy"]), ["Tree nuts", "Dairy"]);
  assert.deepEqual(allergenLabels(["peanuts", "dairy", "egg", "gluten", "soy", "fish", "honey"]), ["Peanuts", "Dairy", "Egg", "Gluten", "Soy", "Fish", "Honey"]);
  assert.deepEqual(allergenLabels(["mustard", "soy"]), ["Soy"]);
  for (const none of [[], null, undefined]) assert.deepEqual(allergenLabels(none), []);
});
