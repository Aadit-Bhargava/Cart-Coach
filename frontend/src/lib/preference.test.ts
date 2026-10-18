import assert from "node:assert/strict";
import { test } from "node:test";
import { matchesWords, preferenceMessage, preferenceWords } from "./preference.ts";

test("preferenceWords keeps the food words, in order, without repeats", () => {
  assert.deepEqual(preferenceWords("paneer"), ["paneer"]);
  assert.deepEqual(preferenceWords("I didn't want rajma, wanted Paneer instead!"), ["rajma", "paneer"]);
  assert.deepEqual(preferenceWords("some more peanuts please"), ["peanuts"]);
  assert.deepEqual(preferenceWords("paneer paneer PANEER"), ["paneer"]);
  assert.deepEqual(preferenceWords("ok"), []);
  assert.deepEqual(preferenceWords(""), []);
});

test("preferenceWords stops at six words", () => {
  assert.deepEqual(preferenceWords("a b c oats dal tofu curd rajma makhana chana"), ["oats", "dal", "tofu", "curd", "rajma", "makhana"]);
});

test("matchesWords looks in the name, ignoring case", () => {
  assert.equal(matchesWords("Sunrise Foods Paneer 200 g", ["paneer"]), true);
  assert.equal(matchesWords("Kisan Fresh Rajma 1 kg", ["paneer"]), false);
  assert.equal(matchesWords("Kisan Fresh Rajma 1 kg", []), false);
});

test("preferenceMessage appears only when something was asked for and nothing matched", () => {
  assert.equal(preferenceMessage("", 0), "");
  assert.equal(preferenceMessage("paneer", 3), "");
  const m = preferenceMessage("sushi", 0);
  assert.ok(m.includes("sushi") && m.includes("fits your goal, diet and budget"), m);
  assert.ok((preferenceMessage("x".repeat(100), 0).match(/x/g) ?? []).length <= 40);
});
