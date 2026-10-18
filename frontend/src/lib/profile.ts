import type { Diet, Profile } from "@/api/types";
import { inr, plural } from "./format";
import { detailsComplete } from "./target";

export const DIET_LABEL: Record<Diet, string> = {
  veg: "Vegetarian",
  vegan: "Vegan",
  eggetarian: "Eggetarian",
  "non-veg": "Eats everything",
  unknown: "Diet not set",
};

/** "110 g protein a day for 3 days, vegetarian, avoids peanuts, likes paneer, budget ₹600" */
export function describeProfile(p: Profile): string {
  return [
    detailsComplete(p) ? `${p.daily_protein_g} g protein a day for ${plural(p.days, "day", "days")}` : "protein target not set",
    DIET_LABEL[p.diet].toLowerCase(),
    p.allergies.length ? `avoids ${p.allergies.join(" and ")}` : "",
    p.likes.length ? `likes ${p.likes.join(", ")}` : "",
    `budget ${inr(p.budget)}`,
  ]
    .filter(Boolean)
    .join(", ");
}

export const splitList = (s: string): string[] =>
  s
    .split(",")
    .map((x) => x.trim().toLowerCase())
    .filter(Boolean);
