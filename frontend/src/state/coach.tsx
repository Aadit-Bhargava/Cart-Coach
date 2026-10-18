import { useMutation } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useRef, type ReactNode } from "react";
import { api } from "@/api";
import { plural } from "@/lib/format";
import { useCatalog } from "./catalog";
import { useDispatch, useStore } from "./store";

interface CoachStatus {
  status: "idle" | "loading" | "error";
  error: unknown;
  retry: () => void;
}

const CoachContext = createContext<CoachStatus>({ status: "idle", error: null, retry: () => undefined });
export const useCoach = () => useContext(CoachContext);

/**
 * Asks the Coach for suggestions whenever the user's own items or their profile
 * change, and only while they have opted in to auto-add. The Coach sees the
 * user's items only, never its own earlier suggestions.
 */
export function CoachProvider({ children }: { children: ReactNode }) {
  const { lines, profile, dismissed } = useStore();
  const dispatch = useDispatch();
  const { byId } = useCatalog();

  const userItems = Object.entries(lines)
    .filter(([, l]) => l.by === "user")
    .map(([id, l]) => ({ product_id: Number(id), quantity: l.qty }));
  const signature = JSON.stringify(userItems);
  const profileKey = JSON.stringify(profile);

  const latest = useRef(0);
  const prevProfile = useRef(profileKey);
  const coachIds = useRef<number[]>([]);
  coachIds.current = Object.entries(lines).filter(([, l]) => l.by === "coach").map(([id]) => Number(id));

  const mutation = useMutation({
    mutationFn: (req: { profileChanged: boolean }) => {
      if (!profile) throw new Error("No profile");
      return api.suggestItems({ profile, cart: userItems, excluded_product_ids: dismissed }).then((res) => ({ res, ...req }));
    },
  });
  const { mutate, reset } = mutation;

  const run = useCallback(
    (profileChanged: boolean) => {
      const ticket = ++latest.current;
      mutate(
        { profileChanged },
        {
          onSuccess: ({ res }) => {
            if (ticket !== latest.current) return; // a newer request is in flight
            const kept = new Set(res.suggestions.map((s) => s.product_id));
            const dropped = coachIds.current.filter((id) => !kept.has(id));
            const note =
              profileChanged && dropped.length
                ? `Coach swapped ${plural(dropped.length, "suggestion", "suggestions")} to match your new details: ${dropped
                    .map((id) => byId.get(id)?.name ?? "an item")
                    .join(", ")}.`
                : "";
            dispatch({ type: "suggested", suggestions: res.suggestions, log: res.log, note });
          },
        },
      );
    },
    [mutate, dispatch, byId],
  );

  useEffect(() => {
    if (!profile?.auto_add || userItems.length === 0) {
      latest.current++;
      reset();
      if (coachIds.current.length) dispatch({ type: "clearSuggestions" });
      return;
    }
    const profileChanged = prevProfile.current !== profileKey;
    prevProfile.current = profileKey;
    const t = setTimeout(() => run(profileChanged), 500);
    return () => clearTimeout(t);
    // run() reads the latest cart and profile, so only their signatures retrigger it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [signature, profileKey]);

  const status: CoachStatus["status"] = mutation.isPending ? "loading" : mutation.isError ? "error" : "idle";
  return <CoachContext.Provider value={{ status, error: mutation.error, retry: () => run(false) }}>{children}</CoachContext.Provider>;
}
