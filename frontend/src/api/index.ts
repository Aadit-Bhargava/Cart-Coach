import { httpApi } from "./http";
import type { CartCoachApi } from "./types";

// The demo API bundles ~200 KB of sample products, so it is only loaded in demo mode.
const demo = () => import("./demo").then((m) => m.demoApi);
const demoApi: CartCoachApi = {
  listProducts: async () => (await demo()).listProducts(),
  understandGoal: async (text) => (await demo()).understandGoal(text),
  suggestItems: async (req) => (await demo()).suggestItems(req),
};

export const api: CartCoachApi = import.meta.env.VITE_API_MODE === "http" ? httpApi : demoApi;
