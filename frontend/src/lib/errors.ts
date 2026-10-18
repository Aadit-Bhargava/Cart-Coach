import { ApiError } from "@/api/http";

/**
 * One plain sentence that says what to do next. It never mentions servers, APIs,
 * status codes or settings: people only need to know whether to check their
 * internet, wait a moment, or try again.
 */
export function whatToDo(e: unknown): string {
  // Sign-in and form problems (400, 401, 409, 429) come with a plain message of their own.
  if (e instanceof ApiError && e.detail && [400, 401, 409, 429].includes(e.status)) return e.detail;
  if (e instanceof ApiError) {
    if (e.status === 0) return "Check your internet connection, then try again.";
    if (e.status === 429) return "That was a lot at once. Wait a few seconds, then try again.";
    if (e.status === 401) return "Your session ended. Sign in again to continue.";
  }
  return "Something went wrong on our side. Try again in a moment.";
}
