import { httpApi } from "./http";
import type { CartCoachApi } from "./types";

// The demo API bundles ~200 KB of sample products, so it is only loaded in demo mode.
const demo = () => import("./demo").then((m) => m.demoApi);
const demoApi: CartCoachApi = {
  requiresSignIn: false,
  signUp: async (n, e, p) => (await demo()).signUp(n, e, p),
  logIn: async (e, p) => (await demo()).logIn(e, p),
  currentUser: async () => (await demo()).currentUser(),
  signOut: async () => (await demo()).signOut(),
  getProfile: async () => (await demo()).getProfile(),
  saveProfile: async (p) => (await demo()).saveProfile(p),
  listDecisions: async () => (await demo()).listDecisions(),
  addDecision: async (d) => (await demo()).addDecision(d),
  listProducts: async () => (await demo()).listProducts(),
  understandGoal: async (text) => (await demo()).understandGoal(text),
  suggestItems: async (req) => (await demo()).suggestItems(req),
};

export const api: CartCoachApi = import.meta.env.VITE_API_MODE === "http" ? httpApi : demoApi;
