// The protein target rule, mirrored from backend/internal/nutrition/target.go so
// demo mode (no backend) behaves like the real service. Change both together.
//
// The factors follow common sports-nutrition ranges. They are general guidance,
// not medical advice and not a clinically validated model. This file has no
// imports so Node's test runner can load it directly.

export type Activity = "general" | "active" | "endurance" | "strength";

export interface BodyStats {
  ageYears: number;
  weightKg: number;
  heightCm: number;
}

export const MIN_DAILY = 40;
export const MAX_DAILY = 220;

function factor(s: BodyStats, a: Activity): [number, string] {
  switch (a) {
    case "active":
      return [1.2, "regular exercise"];
    case "endurance":
      return [1.5, "endurance training"];
    case "strength":
      return [1.6, "strength training"];
    default:
      return [s.ageYears >= 65 ? 1.0 : 0.8, "everyday movement"];
  }
}

/** Height only caps the weight used, so nobody gets an extreme target. It is never shown. */
function referenceWeight(s: BodyStats): number {
  const h = s.heightCm / 100;
  const w25 = 25 * h * h;
  return s.weightKg > 1.2 * w25 ? w25 + 0.4 * (s.weightKg - w25) : s.weightKg;
}

export function dailyProtein(s: BodyStats, a: Activity): { grams: number; basis: string } {
  const [f, label] = factor(s, a);
  const grams = Math.round((referenceWeight(s) * f) / 5) * 5;
  return { grams: Math.min(MAX_DAILY, Math.max(MIN_DAILY, grams)), basis: `${f.toFixed(1)} g per kg of body weight, for ${label}` };
}

/** An amount the user stated is used when it is inside 40 to 220 g, otherwise the rule. */
export function resolveDaily(s: BodyStats, a: Activity, stated: number): { grams: number; basis: string } {
  if (stated >= MIN_DAILY && stated <= MAX_DAILY) return { grams: stated, basis: "the amount you gave" };
  return dailyProtein(s, a);
}

export const cartTarget = (daily: number, days: number): number => daily * days;

/** Reads "72.5" or "72,5". Returns null for anything that is not a plain positive number. */
export function parseDecimal(s: string): number | null {
  const t = s.trim().replace(",", ".");
  if (!/^\d+(\.\d+)?$/.test(t)) return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Profiles saved before these fields existed have null, "" or 0 in them. */
export function detailsComplete(p: {
  age_years?: number | null;
  weight_kg?: number | null;
  height_cm?: number | null;
  activity?: string | null;
  days?: number | null;
  daily_protein_g?: number | null;
}): boolean {
  return p.age_years != null && p.weight_kg != null && p.height_cm != null && !!p.activity && (p.days ?? 0) > 0 && (p.daily_protein_g ?? 0) > 0;
}
