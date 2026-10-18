import type { components, paths } from "./schema";

export type Product = components["schemas"]["Product"];
export type Diet = components["schemas"]["Diet"];
export type Activity = components["schemas"]["Activity"];
export type Profile = components["schemas"]["Profile"];
export type Understanding = components["schemas"]["Understanding"];
export type SavedProfile = components["schemas"]["SavedProfile"];
export type UnderstandResponse = components["schemas"]["UnderstandResponse"];
export type User = components["schemas"]["User"];
export type Suggestion = components["schemas"]["Suggestion"];
export type LogEntry = components["schemas"]["LogEntry"];

export type ProfileTargetResponse =
  paths["/api/profile/target"]["post"]["responses"]["200"]["content"]["application/json"];

/** The personal details sent to compute a protein target. */
export interface StatsInput {
  age_years: number;
  weight_kg: number;
  height_cm: number;
}

export type SuggestRequest =
  paths["/api/coach/suggest"]["post"]["requestBody"]["content"]["application/json"];
export type SuggestResponse =
  paths["/api/coach/suggest"]["post"]["responses"]["200"]["content"]["application/json"];

/** What the UI needs from the backend. Two implementations: http.ts and demo.ts. */
export interface CartCoachApi {
  /** True when the backend needs a signed-in user (http mode). Demo mode needs none. */
  requiresSignIn: boolean;
  signUp(name: string, email: string, password: string): Promise<User>;
  logIn(email: string, password: string): Promise<User>;
  currentUser(): Promise<User | null>;
  signOut(): Promise<void>;
  getProfile(): Promise<SavedProfile | null>;
  saveProfile(profile: SavedProfile): Promise<void>;
  listDecisions(): Promise<LogEntry[]>;
  addDecision(entry: LogEntry): Promise<void>;
  listProducts(): Promise<Product[]>;
  understandGoal(text: string, stats: StatsInput): Promise<Understanding>;
  profileTarget(stats: StatsInput, activity: Activity): Promise<ProfileTargetResponse>;
  suggestItems(req: SuggestRequest): Promise<SuggestResponse>;
}
