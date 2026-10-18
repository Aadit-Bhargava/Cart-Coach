// Word matching for what a shopper asks for when they reject a suggestion ("paneer, not rajma").
// Mirrors backend/internal/coach/preference.go for demo mode. Change both together.
// This file has no imports so Node's test runner can load it directly.

export const MAX_PREFERENCE = 200;
const MAX_WORDS = 6;

// Words that carry no food: they are not matched against product names.
const STOP = new Set(
  "the and not dont don't didnt didn't want wanted wants instead rather than some any something more less with without for please like prefer give get add need but one can could would should too very also just only else other another different choose pick try".split(" "),
);

/** The food words in a request: lowercase, in order, without repeats, at most six. */
export function preferenceWords(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.toLowerCase().match(/[\p{L}']+/gu) ?? []) {
    const w = raw.replace(/^'+|'+$/g, "");
    if ([...w].length < 3 || STOP.has(w) || out.includes(w)) continue;
    out.push(w);
    if (out.length === MAX_WORDS) break;
  }
  return out;
}

export function matchesWords(name: string, words: string[]): boolean {
  const text = name.toLowerCase();
  return words.some((w) => text.includes(w));
}

/**
 * Why nothing the shopper asked for was suggested. Later in this list means the request got closer to
 * being suggested, and the closest reason is the one worth telling the shopper.
 */
export type MissKind = "none" | "profile" | "protein" | "budget" | "gap" | "inCart" | "removed" | "covered" | "spent";
export interface Miss {
  kind: MissKind;
  /** For "profile": the diet or allergy that rules the products out, e.g. "you avoid dairy". */
  cause?: string;
}
const ORDER: MissKind[] = ["none", "profile", "protein", "budget", "gap", "inCart", "removed", "covered", "spent"];

/** Whether `a` got further towards being suggested than `b`. */
export const closer = (a: Miss, b: Miss) => ORDER.indexOf(a.kind) > ORDER.indexOf(b.kind);

/** A plain explanation of why what the shopper asked for was not suggested. Empty when it was found. */
export function preferenceMessage(preference: string, matches: number, miss: Miss): string {
  if (!preference || matches > 0) return "";
  const short = [...preference].length > 40 ? [...preference].slice(0, 40).join("") + "…" : preference;
  switch (miss.kind) {
    case "profile":
      return `Coach left out "${short}" because your profile says ${miss.cause}. Use Edit in "What Coach understood" if that's not right.`;
    case "protein":
      return `"${short}" isn't a high-protein pick in the demo data, so Coach left it out.`;
    case "budget":
      return `"${short}" costs more than the budget you have left.`;
    case "gap":
      return `A pack of "${short}" has more protein than you still need, so Coach left it out.`;
    case "inCart":
      return `You already have "${short}" in your cart.`;
    case "removed":
      return `You removed the "${short}" Coach showed, so it won't suggest it again.`;
    case "covered":
      return `Your protein goal is already covered, so Coach has nothing to add, including "${short}".`;
    case "spent":
      return `Your cart already uses your whole budget, so Coach can't add "${short}".`;
    default:
      return `Coach couldn't find "${short}" in the store.`;
  }
}
