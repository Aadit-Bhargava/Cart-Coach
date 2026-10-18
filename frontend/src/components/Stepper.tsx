import { cx } from "./ui";

export function Stepper({ qty, onInc, onDec, small }: { qty: number; onInc: () => void; onDec: () => void; small?: boolean }) {
  const btn = cx("grid place-items-center rounded-xl text-xl text-white hover:bg-white/15", small ? "size-9" : "size-11");
  return (
    <div className={cx("flex items-center rounded-xl bg-ink text-white", small ? "h-9" : "h-11")}>
      <button type="button" className={btn} onClick={onDec} aria-label="Remove one">
        −
      </button>
      <output className="min-w-6 text-center font-bold" aria-label="Quantity">
        {qty}
      </output>
      <button type="button" className={btn} onClick={onInc} aria-label="Add one">
        +
      </button>
    </div>
  );
}
