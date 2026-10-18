import { z } from "zod";
import type { Profile, ProfileTargetResponse, SavedProfile, SuggestResponse, UnderstandResponse, Understanding, User } from "./types";

export const dietSchema = z.enum(["veg", "vegan", "eggetarian", "non-veg", "unknown"]);

export const activitySchema = z.enum(["general", "active", "endurance", "strength"]);

export const understandingSchema = z.object({
  activity: activitySchema,
  diet: dietSchema,
  allergies: z.array(z.string()),
  likes: z.array(z.string()),
  daily_protein_g: z.number().int(),
  basis: z.string(),
}) satisfies z.ZodType<Understanding>;

export const profileSchema = z.object({
  protein_target_g: z.number().int(),
  diet: dietSchema,
  allergies: z.array(z.string()),
  likes: z.array(z.string()),
  budget: z.number().min(50),
  auto_add: z.boolean(),
  age_years: z.number().int().nullable(),
  weight_kg: z.number().nullable(),
  height_cm: z.number().nullable(),
  activity: z.string(),
  days: z.number().int(),
  daily_protein_g: z.number().int(),
}) satisfies z.ZodType<Profile>;

export const savedProfileSchema = profileSchema.extend({
  goal_text: z.string(),
  details_complete: z.boolean(),
}) satisfies z.ZodType<SavedProfile>;

export const profileTargetSchema = z.object({
  daily_protein_g: z.number().int(),
  basis: z.string(),
}) satisfies z.ZodType<ProfileTargetResponse>;

export const userSchema = z.object({ id: z.number().int(), email: z.string(), name: z.string() }) satisfies z.ZodType<User>;

export const logEntriesSchema = z.object({
  decisions: z.array(z.object({ title: z.string(), detail: z.string(), created_at: z.string().optional() })),
});

export const understandResponseSchema = z.object({
  understanding: understandingSchema.optional(),
  support_message: z.string().optional(),
}) satisfies z.ZodType<UnderstandResponse>;

export const suggestResponseSchema = z.object({
  suggestions: z.array(
    z.object({
      product_id: z.number().int(),
      protein_g: z.number(),
      price: z.number(),
      reason: z.string(),
      why: z.string().optional(),
    }),
  ),
  log: z.object({ title: z.string(), detail: z.string(), created_at: z.string().optional() }),
}) satisfies z.ZodType<SuggestResponse>;
