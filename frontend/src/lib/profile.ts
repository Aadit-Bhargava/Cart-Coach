import type { Diet, Profile } from "@/api/types";
import { inr } from "./format";

export const DIET_LABEL: Record<Diet, string> = {
  veg: "Vegetarian",
  vegan: "Vegan",
  eggetarian: "Eggetarian",
  "non-veg": "Eats everything",
  unknown: "Diet not set",
};

/** "110 g protein, vegetarian, avoids peanuts, likes paneer, budget ₹600" */
export function describeProfile(p: Profile): string {
  return [
    `${p.protein_target_g} g protein`,
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
