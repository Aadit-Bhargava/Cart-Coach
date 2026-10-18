import { useEffect, useRef, type ReactNode } from "react";

interface Props {
  open: boolean;
  onClose: () => void;
  label: string;
  variant: "side" | "center";
  /** False for the first-run goal popup: no Close button, no Escape, no outside click. */
  dismissable?: boolean;
  children: ReactNode;
}

export function Dialog({ open, onClose, label, variant, dismissable = true, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label={label}
      className={`sheet ${variant === "side" ? "sheet-side" : "sheet-center"}`}
      onCancel={(e) => {
        e.preventDefault();
        if (dismissable) onClose();
      }}
      onClick={(e) => {
        if (dismissable && e.target === e.currentTarget) onClose();
      }}
    >
      {open && (
        <div className="relative">
          {dismissable && (
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="absolute right-3.5 top-3.5 z-10 grid size-11 place-items-center rounded-full bg-ground text-lg hover:bg-line"
            >
              ✕
            </button>
          )}
          {children}
        </div>
      )}
    </dialog>
  );
}
