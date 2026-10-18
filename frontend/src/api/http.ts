import {
  logEntriesSchema,
  profileTargetSchema,
  savedProfileSchema,
  suggestResponseSchema,
  understandResponseSchema,
  userSchema,
} from "./validate";
import type { CartCoachApi, Product } from "./types";

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    /** The plain-language message the service sent, safe to show to people. */
    readonly detail?: string,
  ) {
    super(message);
  }
}

/** The goal text suggested distress, so Coach shows this message and gives no targets. */
export class SupportMessage extends Error {}

/** Fired when the server says the session has ended, so the app can show sign-in again. */
export const SIGNED_OUT_EVENT = "cartcoach:signed-out";

// The session is an HttpOnly cookie set by the server, so the page never sees it.
async function call<T>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    throw new ApiError(`No response from ${path}`, 0); // offline, or the service is unreachable
  }
  if (res.status === 401 && !path.startsWith("/api/auth/")) window.dispatchEvent(new Event(SIGNED_OUT_EVENT));
  if (!res.ok) {
    const body = (await res.json().catch(() => null)) as { error?: unknown } | null;
    throw new ApiError(`Request to ${path} failed (${res.status})`, res.status, typeof body?.error === "string" ? body.error : undefined);
  }
  if (res.status === 204) return undefined as T;
  return (await res.json()) as T;
}

const send = (method: string, path: string, body: unknown) =>
  call<unknown>(path, { method, body: JSON.stringify(body) });

/** Calls the Go service. Everything it returns is checked with zod before the UI sees it. */
export const httpApi: CartCoachApi = {
  requiresSignIn: true,

  async signUp(name, email, password) {
    return userSchema.parse(await send("POST", "/api/auth/signup", { name, email, password }));
  },

  async logIn(email, password) {
    return userSchema.parse(await send("POST", "/api/auth/login", { email, password }));
  },

  async currentUser() {
    try {
      return userSchema.parse(await call<unknown>("/api/auth/me"));
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) return null;
      throw e;
    }
  },

  async signOut() {
    await send("POST", "/api/auth/logout", {});
  },

  async getProfile() {
    try {
      return savedProfileSchema.parse(await call<unknown>("/api/profile"));
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) return null;
      throw e;
    }
  },

  async saveProfile(profile) {
    await send("PUT", "/api/profile", profile);
  },

  async listDecisions() {
    return logEntriesSchema.parse(await call<unknown>("/api/decisions")).decisions;
  },

  async addDecision(entry) {
    await send("POST", "/api/decisions", { title: entry.title, detail: entry.detail });
  },

  async listProducts() {
    const data = await call<{ products: Product[] }>("/api/products");
    return data.products;
  },

  async profileTarget(stats, activity) {
    return profileTargetSchema.parse(await send("POST", "/api/profile/target", { ...stats, activity }));
  },

  async understandGoal(text, stats) {
    const res = understandResponseSchema.parse(await send("POST", "/api/profile/understand", { text, ...stats }));
    if (res.support_message) throw new SupportMessage(res.support_message);
    if (!res.understanding) throw new ApiError("Empty response from /api/profile/understand", 200);
    return res.understanding;
  },

  async suggestItems(req) {
    return suggestResponseSchema.parse(await send("POST", "/api/coach/suggest", req));
  },
};
