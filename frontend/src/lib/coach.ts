// Rule-based stand-in for the Coach (Gemini goal understanding, suggestion
// picking and the Verifier). Used only by the demo API. Nothing here is medical
// or dietary advice: it matches protein to a number the user can change.
import type { Diet, Profile } from "@/api/types";
import { closer, matchesWords, preferenceWords, type Miss } from "./preference";
import type { Activity } from "./target";
import { grams, inr } from "./format";
import type { ProductView } from "./product";

const DAIRYISH = ["Dairy", "Dairy Alternatives and More", "Ice Cream and Desserts", "Mithai and Sweets"];
const NOT_SUGGESTED = ["Spices", "Cooking Oils", "Sauces and Spreads"];
const isNonVeg = (p: ProductView) => p.category === "Meat, Fish and Eggs" || /chicken|mutton|fish|prawn/i.test(p.name);
const isEgg = (p: ProductView) => /\begg/i.test(p.name);
// Same rule as the dairy tag in backend/cmd/seed/diet.go: a Dairy-type category, or a dairy word in the name.
const isDairy = (p: ProductView) =>
  !/oat milk|soy milk|almond milk/i.test(p.name) &&
  (DAIRYISH.includes(p.category) ||
    /paneer|ghee|butter|cheese|curd|dahi|lassi|milk|cream|yoghurt|kulfi|mozzarella|peda|rasgulla|gulab jamun|halwa|laddoo|soan papdi|whey|croissant/i.test(p.name));

/** The catalog has no diet field yet, so diet is inferred from category and name. */
export function isAllowed(p: ProductView, profile: Profile): boolean {
  return blockedBy(p, profile) === "";
}

/** Says, in plain words, which diet or allergy rules a product out. Empty when it is allowed. */
export function blockedBy(p: ProductView, profile: Profile): string {
  const { diet, allergies } = profile;
  if (diet === "veg" && (isNonVeg(p) || isEgg(p))) return "your diet is vegetarian";
  if (diet === "eggetarian" && isNonVeg(p) && !isEgg(p)) return "your diet is eggetarian";
  if (diet === "vegan" && (isNonVeg(p) || isEgg(p) || isDairy(p) || /honey/i.test(p.name))) return "your diet is vegan";
  if (allergies.includes("dairy") && isDairy(p)) return "you avoid dairy";
  if (allergies.includes("peanuts") && /peanut|chikki/i.test(p.name)) return "you avoid peanuts";
  return "";
}

export interface TextReading {
  activity: Activity;
  diet: Diet;
  allergies: string[];
  likes: string[];
  /** A daily protein amount the text states, or 0. */
  stated: number;
}

/** A rough, rule-based reading of the goal text, standing in for Gemini in demo mode. */
export function understandText(text: string): TextReading {
  const t = text.toLowerCase();
  const stated = Number(/(\d{2,3})\s*g\b/.exec(t)?.[1] ?? 0);
  const activity: Activity = /ironman|marathon|triathlon|running|runner|cycling|swimming|\brun\b/.test(t)
    ? "endurance"
    : /gym|lift|muscle|bodybuild|powerlift|bulk/.test(t)
      ? "strength"
      : /football|cricket|sport|exercise|workout|yoga|train/.test(t)
        ? "active"
        : "general";
  const diet: Diet = /vegan/.test(t)
    ? "vegan"
    : /egg/.test(t) && /veg/.test(t)
      ? "eggetarian"
      : /\bveg(etarian)?\b|veggie|no meat/.test(t)
        ? "veg"
        : "unknown";
  const allergies: string[] = [];
  if (/peanut/.test(t) && /allerg|can'?t eat|no peanut|avoid/.test(t)) allergies.push("peanuts");
  if (/lactose|dairy[- ]free|allergic to (milk|dairy)/.test(t)) allergies.push("dairy");
  const likes = ["paneer", "peanut", "oats", "dal", "makhana", "rajma", "chana", "lassi", "muesli", "tofu", "eggs"].filter(
    (w) => t.includes(w) && !(w === "peanut" && allergies.includes("peanuts")),
  );
  return { activity, diet, allergies, likes, stated };
}

export interface PickInput {
  products: ProductView[];
  profile: Profile;
  cart: { product: ProductView; quantity: number }[];
  excluded: number[];
  /** What the shopper asked for when they rejected a suggestion. Empty when nothing was asked. */
  preference: string;
}

export function pickSuggestions({ products, profile, cart, excluded, preference }: PickInput): { picks: ProductView[]; matches: number; miss: Miss } {
  const words = preferenceWords(preference);
  const asked = (p: ProductView) => matchesWords(`${p.name} ${p.category}`, words);
  let matches = 0;
  const inCart = new Set(cart.map((l) => l.product.id));
  let spent = cart.reduce((a, l) => a + l.product.price * l.quantity, 0);
  let have = cart.reduce((a, l) => a + (l.product.packProtein ?? 0) * l.quantity, 0);
  const picks: ProductView[] = [];
  let miss: Miss = { kind: "none" };
  const startGap = profile.protein_target_g - have;
  if (words.length && startGap < 4) miss = { kind: "covered" };
  else if (words.length && spent >= profile.budget) miss = { kind: "spent" };
  else if (words.length) {
    // Why each product the shopper asked for cannot be suggested; the closest reason is the one shown.
    for (const p of products.filter(asked)) {
      const m = missFor(p, profile, { gap: startGap, spent, inCart, excluded });
      if (m.kind !== "none" && closer(m, miss)) miss = m;
    }
  }
  for (let i = 0; i < 3; i++) {
    const gap = profile.protein_target_g - have;
    if (gap < 4) break;
    const liked = (p: ProductView) => (profile.likes.some((w) => p.name.toLowerCase().includes(w)) ? 1.5 : 1);
    const eligible = products
      .filter(
        (p) =>
          p.packProtein != null &&
          p.proteinPerRupee != null &&
          (p.protein_g ?? 0) >= 15 &&
          p.packProtein >= 4 &&
          p.packProtein <= gap &&
          !NOT_SUGGESTED.includes(p.category) &&
          !inCart.has(p.id) &&
          !excluded.includes(p.id) &&
          !picks.includes(p) &&
          isAllowed(p, profile) &&
          spent + p.price <= profile.budget,
      );
    if (i === 0) matches = eligible.filter(asked).length;
    // Items the shopper asked for come first, then the usual order.
    const best = [...eligible].sort((a, b) => Number(asked(b)) - Number(asked(a)) || (b.proteinPerRupee ?? 0) * liked(b) - (a.proteinPerRupee ?? 0) * liked(a))[0];
    if (!best || best.packProtein == null) break;
    picks.push(best);
    spent += best.price;
    have += best.packProtein;
  }
  return { picks, matches, miss };
}

/** Why a product cannot be suggested, or "none" when it can. Mirrors the checks in pickSuggestions. */
function missFor(p: ProductView, profile: Profile, s: { gap: number; spent: number; inCart: Set<number>; excluded: number[] }): Miss {
  const cause = blockedBy(p, profile);
  if (cause) return { kind: "profile", cause };
  if (NOT_SUGGESTED.includes(p.category) || p.packProtein == null || p.proteinPerRupee == null || (p.protein_g ?? 0) < 15 || p.packProtein < 4) return { kind: "protein" };
  if (s.spent + p.price > profile.budget) return { kind: "budget" };
  if (p.packProtein > s.gap) return { kind: "gap" };
  if (s.inCart.has(p.id)) return { kind: "inCart" };
  if (s.excluded.includes(p.id)) return { kind: "removed" };
  return { kind: "none" };
}

export const reasonFor = (p: ProductView) => `+${grams(p.packProtein ?? 0)} g protein, ${inr(p.price)} more`;

export const sourceFor = (p: ProductView) =>
  `${p.name}: ${grams(p.protein_g ?? 0)} g protein per 100 g × ${p.packText} = ${grams(p.packProtein ?? 0)} g; ${inr(p.price)} demo price`;
