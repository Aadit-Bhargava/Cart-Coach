import { useQuery } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/api";
import { SIGNED_OUT_EVENT } from "@/api/http";
import type { User } from "@/api/types";
import { AuthContext, type Auth } from "@/state/auth";
import { useDispatch } from "@/state/store";

/**
 * Knows who is signed in and loads their saved goal and decision log. It never
 * hides the shop: the homepage always renders, and the sign-in popup opens over
 * it when there is no session. Demo mode needs no sign-in.
 */
export function Session({ children }: { children: ReactNode }) {
  if (!api.requiresSignIn) return <>{children}</>;
  return <HttpSession>{children}</HttpSession>;
}

function HttpSession({ children }: { children: ReactNode }) {
  const dispatch = useDispatch();
  const [user, setUser] = useState<User | null | undefined>(undefined); // undefined: still checking
  const [ready, setReady] = useState(false);
  const [expired, setExpired] = useState(false);

  const me = useQuery({ queryKey: ["me"], queryFn: () => api.currentUser(), retry: false, staleTime: Infinity });
  useEffect(() => {
    if (me.isSuccess) setUser(me.data);
  }, [me.isSuccess, me.data]);

  // The server ended the session (it expired, or the user was removed).
  useEffect(() => {
    const onSignedOut = () => {
      setUser(null);
      setReady(false);
      setExpired(true);
    };
    window.addEventListener(SIGNED_OUT_EVENT, onSignedOut);
    return () => window.removeEventListener(SIGNED_OUT_EVENT, onSignedOut);
  }, []);

  const uid = user?.id;
  const profile = useQuery({ queryKey: ["profile", uid], queryFn: () => api.getProfile(), enabled: uid !== undefined && user !== null, retry: false, staleTime: Infinity });
  const log = useQuery({ queryKey: ["decisions", uid], queryFn: () => api.listDecisions(), enabled: uid !== undefined && user !== null, retry: false, staleTime: Infinity });

  useEffect(() => {
    if (user && profile.isSuccess && log.isSuccess && !ready) {
      dispatch({ type: "loaded", profile: profile.data, log: log.data });
      setReady(true);
    }
  }, [user, profile.isSuccess, profile.data, log.isSuccess, log.data, ready, dispatch]);

  const status: Auth["status"] = me.isError || profile.isError || log.isError ? "error" : user === undefined ? "checking" : user === null ? "signedOut" : "signedIn";

  const value: Auth = {
    status,
    user: user ?? null,
    ready,
    expired,
    error: me.error ?? profile.error ?? log.error,
    signedIn: (u) => {
      setReady(false);
      setExpired(false);
      setUser(u);
    },
    signOut: () => void api.signOut().finally(() => window.location.reload()),
    retry: () => {
      void me.refetch();
      if (user) {
        void profile.refetch();
        void log.refetch();
      }
    },
  };
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
