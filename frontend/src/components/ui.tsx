import type { ButtonHTMLAttributes, ReactNode } from "react";

const cx = (...c: (string | false | undefined)[]) => c.filter(Boolean).join(" ");

export function Button({
  variant = "outline",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: "outline" | "solid" | "coach" | "ghost" }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        "inline-flex min-h-11 items-center justify-center rounded-xl px-5 font-bold transition-colors disabled:opacity-50",
        variant === "outline" && "border-[1.5px] border-ink bg-white hover:bg-ink hover:text-white",
        variant === "solid" && "bg-ink text-white hover:bg-[#2a2a55]",
        variant === "coach" && "bg-coach text-white hover:bg-coach-press",
        variant === "ghost" && "border-[1.5px] border-ink bg-white",
        className,
      )}
    />
  );
}

export function LinkButton({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...props}
      className={cx("inline-flex min-h-11 items-center font-bold text-coach underline underline-offset-4", className)}
    />
  );
}

export function Spinner() {
  return (
    <span
      aria-hidden
      className="inline-block size-[18px] shrink-0 rounded-full border-[3px] border-coach border-r-transparent motion-safe:animate-[spin_0.8s_linear_infinite]"
    />
  );
}

export function Loading({ children, big }: { children: ReactNode; big?: boolean }) {
  return (
    <div
      role="status"
      className={cx(
        "flex items-center gap-2.5 rounded-2xl bg-coach-tint font-semibold text-coach",
        big ? "justify-center px-5 py-9 text-base" : "p-3.5",
      )}
    >
      <Spinner />
      {children}
    </div>
  );
}

/** Neutral placeholder: the category initial on a soft tile. No product photos. */
export function Tile({ category, className, textClass = "text-6xl" }: { category: string; className?: string; textClass?: string }) {
  return (
    <div aria-hidden className={cx("grid place-items-center bg-tile font-display font-extrabold text-[#bdbbd6]", textClass, className)}>
      {category.charAt(0)}
    </div>
  );
}

export const field =
  "mt-1.5 block min-h-12 w-full rounded-xl border border-line bg-white px-3.5 py-2 text-[15px]";
export { cx };
