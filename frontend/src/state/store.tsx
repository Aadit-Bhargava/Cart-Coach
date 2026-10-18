import { createContext, useContext, useEffect, useMemo, useReducer, useRef, type Dispatch, type ReactNode } from "react";
import { api } from "@/api";
import { profileSchema } from "@/api/validate";
import type { LogEntry, Profile, SavedProfile, Suggestion } from "@/api/types";

export type Source = "user" | "coach";
export interface Line {
  qty: number;
  by: Source;
}

/** A log entry. `client` marks entries the user caused here, which are also saved to the server. */
export type LogItem = LogEntry & { client?: boolean };

export interface State {
  lines: Record<number, Line>;
  profile: Profile | null;
  /** The user's original words, kept so they can retake the description. */
  goalText: string;
  log: LogItem[];
  /** One-line explanation shown in the cart after Coach changed its mind. */
  note: string;
  /** Suggestions the user removed. Coach does not suggest them again. */
  dismissed: number[];
  /** What the shopper asked for when they rejected a suggestion. Sent with every Coach request until cleared. */
  preference: string;
  /** Goes up when the shopper asks for another pick, so Coach asks again even if nothing else changed. */
  refresh: number;
}

export type Action =
  | { type: "add"; id: number }
  | { type: "step"; id: number; delta: 1 | -1 }
  | { type: "keep"; id: number; name: string }
  | { type: "dismiss"; id: number; name: string }
  | { type: "findAnother"; id: number; name: string; preference: string }
  | { type: "setPreference"; preference: string }
  | { type: "loaded"; profile: SavedProfile | null; log: LogEntry[] }
  | { type: "undoAll" }
  | { type: "clearSuggestions" }
  | { type: "saveProfile"; profile: Profile; text: string; summary: string }
  | { type: "suggested"; suggestions: Suggestion[]; log: LogEntry; note: string };

const STORAGE_KEY = "cartcoach.goal";

function load(): Pick<State, "profile" | "goalText"> {
  // With a backend, the profile comes from the server after sign-in.
  if (api.requiresSignIn) return { profile: null, goalText: "" };
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { profile: null, goalText: "" };
    const data = JSON.parse(raw) as { profile?: unknown; goalText?: unknown };
    const profile = profileSchema.safeParse(data.profile);
    return profile.success
      ? { profile: profile.data, goalText: typeof data.goalText === "string" ? data.goalText : "" }
      : { profile: null, goalText: "" };
  } catch {
    return { profile: null, goalText: "" };
  }
}

const init = (): State => ({ lines: {}, log: [], note: "", dismissed: [], preference: "", refresh: 0, ...load() });

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case "add": {
      const line = s.lines[a.id];
      return { ...s, note: "", lines: { ...s.lines, [a.id]: { qty: (line?.qty ?? 0) + 1, by: "user" } } };
    }
    case "step": {
      const line = s.lines[a.id];
      if (!line) return s;
      const lines = { ...s.lines };
      const qty = line.qty + a.delta;
      if (qty <= 0) delete lines[a.id];
      else lines[a.id] = { ...line, qty };
      return { ...s, note: "", lines };
    }
    case "loaded": {
      if (!a.profile) return { ...s, profile: null, goalText: "", log: a.log };
      const { goal_text, details_complete: _complete, ...profile } = a.profile;
      return { ...s, profile, goalText: goal_text, log: a.log };
    }
    case "keep": {
      const line = s.lines[a.id];
      if (!line) return s;
      return {
        ...s,
        lines: { ...s.lines, [a.id]: { ...line, by: "user" } },
        log: [{ title: "You kept a suggestion", detail: a.name, client: true }, ...s.log],
      };
    }
    case "dismiss": {
      const lines = { ...s.lines };
      delete lines[a.id];
      return {
        ...s,
        lines,
        dismissed: [...s.dismissed, a.id],
        log: [{ title: "You removed a suggestion", detail: a.name, client: true }, ...s.log],
      };
    }
    case "findAnother": {
      const lines = { ...s.lines };
      delete lines[a.id];
      const asked = a.preference.replace(/\s+/g, " ").trim().slice(0, 200);
      return {
        ...s,
        lines,
        dismissed: [...s.dismissed, a.id],
        preference: asked || s.preference,
        refresh: s.refresh + 1,
        log: [{ title: "You asked Coach for something else", detail: asked ? `${a.name}. You asked for: ${asked}` : a.name, client: true }, ...s.log],
      };
    }
    case "setPreference":
      return { ...s, preference: a.preference };
    case "undoAll": {
      const ids = Object.entries(s.lines).filter(([, l]) => l.by === "coach").map(([id]) => Number(id));
      const lines = { ...s.lines };
      ids.forEach((id) => delete lines[id]);
      return {
        ...s,
        lines,
        dismissed: [...s.dismissed, ...ids],
        log: [{ title: `You undid ${ids.length} suggestions`, detail: "Cart returned to your own items.", client: true }, ...s.log],
      };
    }
    case "clearSuggestions":
      return { ...s, note: "", preference: "", lines: Object.fromEntries(Object.entries(s.lines).filter(([, l]) => l.by === "user")) };
    case "saveProfile":
      return {
        ...s,
        profile: a.profile,
        goalText: a.text,
        dismissed: [],
        log: [{ title: s.profile ? "You updated what Coach understood" : "You set your goal", detail: a.summary, client: true }, ...s.log],
      };
    case "suggested": {
      const lines = Object.fromEntries(Object.entries(s.lines).filter(([, l]) => l.by === "user"));
      for (const sug of a.suggestions) lines[sug.product_id] ??= { qty: 1, by: "coach" };
      return { ...s, lines, note: a.note, log: [a.log, ...s.log] };
    }
  }
}

const StateContext = createContext<State | null>(null);
const DispatchContext = createContext<Dispatch<Action> | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, init);
  const saved = useMemo(() => JSON.stringify({ profile: state.profile, goalText: state.goalText }), [state.profile, state.goalText]);
  useEffect(() => {
    if (api.requiresSignIn) return; // the server keeps the profile
    try {
      localStorage.setItem(STORAGE_KEY, saved);
    } catch {
      // Private mode or full storage: the goal just won't survive a reload.
    }
  }, [saved]);
  // Things the user did here (kept, removed, undid, changed goal) go into the server's log too.
  const posted = useRef(new WeakSet<object>());
  useEffect(() => {
    if (!api.requiresSignIn) return;
    for (const entry of state.log) {
      if (!entry.client || posted.current.has(entry)) continue;
      posted.current.add(entry);
      api.addDecision({ title: entry.title, detail: entry.detail }).catch(() => undefined);
    }
  }, [state.log]);

  return (
    <StateContext.Provider value={state}>
      <DispatchContext.Provider value={dispatch}>{children}</DispatchContext.Provider>
    </StateContext.Provider>
  );
}

export function useStore(): State {
  const v = useContext(StateContext);
  if (!v) throw new Error("useStore outside StoreProvider");
  return v;
}
export function useDispatch(): Dispatch<Action> {
  const v = useContext(DispatchContext);
  if (!v) throw new Error("useDispatch outside StoreProvider");
  return v;
}
