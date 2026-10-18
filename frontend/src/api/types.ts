import type { components, paths } from "./schema";

export type Product = components["schemas"]["Product"];
export type Diet = components["schemas"]["Diet"];
export type Profile = components["schemas"]["Profile"];
export type Understanding = components["schemas"]["Understanding"];
export type SavedProfile = components["schemas"]["SavedProfile"];
export type UnderstandResponse = components["schemas"]["UnderstandResponse"];
export type User = components["schemas"]["User"];
export type Suggestion = components["schemas"]["Suggestion"];
export type LogEntry = components["schemas"]["LogEntry"];

export type SuggestRequest =
  paths["/api/coach/suggest"]["post"]["requestBody"]["content"]["application/json"];
export type SuggestResponse =
  paths["/api/coach/suggest"]["post"]["responses"]["200"]["content"]["application/json"];

/** What the UI needs from the backend. Two implementations: http.ts and demo.ts. */
export interface CartCoachApi {
  listProducts(): Promise<Product[]>;
  understandGoal(text: string): Promise<Understanding>;
  suggestItems(req: SuggestRequest): Promise<SuggestResponse>;
}
