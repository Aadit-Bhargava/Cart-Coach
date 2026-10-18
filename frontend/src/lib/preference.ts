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

/** A plain explanation for when nothing eligible matched the request. */
export function preferenceMessage(preference: string, matches: number): string {
  if (!preference || matches > 0) return "";
  const short = [...preference].length > 40 ? [...preference].slice(0, 40).join("") + "…" : preference;
  return `Nothing matching "${short}" fits your goal, diet and budget, so these are the best alternatives.`;
}
