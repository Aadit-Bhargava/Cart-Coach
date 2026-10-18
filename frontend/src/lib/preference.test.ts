import assert from "node:assert/strict";
import { test } from "node:test";
import { closer, matchesWords, preferenceMessage, preferenceWords, type Miss } from "./preference.ts";

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

const NONE: Miss = { kind: "none" };

test("preferenceMessage appears only when something was asked for and nothing matched", () => {
  assert.equal(preferenceMessage("", 0, NONE), "");
  assert.equal(preferenceMessage("paneer", 3, { kind: "profile", cause: "you avoid dairy" }), "");
  assert.ok((preferenceMessage("x".repeat(100), 0, NONE).match(/x/g) ?? []).length <= 40);
});

test("preferenceMessage says why the request was left out", () => {
  const cases: [Miss, string][] = [
    [NONE, "couldn't find"],
    [{ kind: "profile", cause: "you avoid dairy" }, "you avoid dairy"],
    [{ kind: "profile", cause: "you avoid dairy" }, "Edit"],
    [{ kind: "protein" }, "high-protein"],
    [{ kind: "budget" }, "budget"],
    [{ kind: "gap" }, "more protein than you still need"],
    [{ kind: "inCart" }, "already have"],
    [{ kind: "removed" }, "removed"],
    [{ kind: "covered" }, "already covered"],
    [{ kind: "spent" }, "whole budget"],
  ];
  for (const [miss, want] of cases) {
    const m = preferenceMessage("paneer", 0, miss);
    assert.ok(m.includes("paneer") && m.includes(want), `${miss.kind}: ${m}`);
  }
});

test("closer picks the reason nearest to being suggested", () => {
  assert.equal(closer({ kind: "budget" }, { kind: "profile", cause: "x" }), true);
  assert.equal(closer({ kind: "profile", cause: "x" }, { kind: "budget" }), false);
  assert.equal(closer({ kind: "profile", cause: "x" }, NONE), true);
  assert.equal(closer(NONE, NONE), false);
});
