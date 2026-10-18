import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from "react";

const ToastContext = createContext<(msg: string) => void>(() => undefined);
export const useToast = () => useContext(ToastContext);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState("");
  const timer = useRef<number>(undefined);
  const show = useCallback((m: string) => {
    setMsg(m);
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setMsg(""), 2800);
  }, []);
  return (
    <ToastContext.Provider value={show}>
      {children}
      <div
        role="status"
        className={`pointer-events-none fixed bottom-7 left-1/2 z-[100] -translate-x-1/2 rounded-2xl bg-ink px-5 py-3 font-semibold text-white transition-all duration-300 ${
          msg ? "translate-y-0 opacity-100" : "translate-y-8 opacity-0"
        }`}
      >
        {msg}
      </div>
    </ToastContext.Provider>
  );
}
