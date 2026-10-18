import { suggestResponseSchema, understandResponseSchema } from "./validate";
import type { CartCoachApi, Product } from "./types";

class ApiError extends Error {}

/** The goal text suggested distress, so Coach shows this message and gives no targets. */
export class SupportMessage extends Error {}

const USER_KEY = "cartcoach.userId";

/** The prototype sign-in: the signed-in user's id is sent as X-User-ID. */
export const session = {
  get userId(): string | null {
    try {
      return localStorage.getItem(USER_KEY);
    } catch {
      return null;
    }
  },
  set userId(id: string | null) {
    try {
      if (id) localStorage.setItem(USER_KEY, id);
      else localStorage.removeItem(USER_KEY);
    } catch {
      // Storage is unavailable; the user will have to sign in again.
    }
  },
};

async function call<T>(path: string, init?: RequestInit): Promise<T> {
  const userId = session.userId;
  const res = await fetch(path, {
    ...init,
    headers: { "Content-Type": "application/json", ...(userId ? { "X-User-ID": userId } : {}), ...init?.headers },
  });
  if (!res.ok) throw new ApiError(`Request to ${path} failed (${res.status})`);
  return (await res.json()) as T;
}

const post = (path: string, body: unknown) =>
  call<unknown>(path, { method: "POST", body: JSON.stringify(body) });

/** Calls the Go service. Model output is checked with zod before the UI sees it. */
export const httpApi: CartCoachApi = {
  async listProducts() {
    const data = await call<{ products: Product[] }>("/api/products");
    return data.products;
  },
  async understandGoal(text) {
    const res = understandResponseSchema.parse(await post("/api/profile/understand", { text }));
    if (res.support_message) throw new SupportMessage(res.support_message);
    if (!res.understanding) throw new ApiError("Empty response from /api/profile/understand");
    return res.understanding;
  },
  async suggestItems(req) {
    return suggestResponseSchema.parse(await post("/api/coach/suggest", req));
  },
};
