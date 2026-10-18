import type { Diet } from "@/api/types";
import type { Activity } from "./target";

export interface Reading {
  activity: Activity;
  daily_protein_g: number;
  basis: string;
  diet: Diet;
  allergies: string[];
  likes: string[];
}

export interface SavedWords {
  diet: Diet;
  allergies: string;
  likes: string;
}

/**
 * What the confirm screen shows after Coach reads the goal text. The full popup takes everything from
 * the new reading. The short "add your details" popup only needs the activity and the protein amount,
 * so it keeps the diet, allergies and likes the person already saved: they are a hard filter, and
 * someone asked only for age, weight and height does not expect them to change.
 */
export function applyUnderstanding(mode: "full" | "details", saved: SavedWords, u: Reading) {
  return {
    activity: u.activity,
    daily: u.daily_protein_g,
    basis: u.basis,
    diet: mode === "details" ? saved.diet : u.diet,
    allergies: mode === "details" ? saved.allergies : u.allergies.join(", "),
    likes: mode === "details" ? saved.likes : u.likes.join(", "),
  };
}
