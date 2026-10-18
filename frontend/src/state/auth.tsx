import { createContext, useContext } from "react";
import type { User } from "@/api/types";

export interface Auth {
  /** checking: asking the server; error: the server or account data could not be reached. */
  status: "checking" | "signedOut" | "signedIn" | "error";
  user: User | null;
  /** True once the signed-in user's saved goal and decision log have loaded (always true in demo mode). */
  ready: boolean;
  /** True when a signed-in session ended, so the sign-in popup can say why. */
  expired: boolean;
  /** Why the account could not load, when status is error. */
  error: unknown;
  signedIn: (u: User) => void;
  signOut: () => void;
  retry: () => void;
}

export const AuthContext = createContext<Auth>({
  status: "signedIn",
  user: null,
  ready: true,
  expired: false,
  error: null,
  signedIn: () => undefined,
  signOut: () => undefined,
  retry: () => undefined,
});
export const useAuth = () => useContext(AuthContext);
