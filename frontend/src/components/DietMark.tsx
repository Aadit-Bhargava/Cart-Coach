import { dietMark, type DietMarkKind } from "@/lib/diet";

const MARKS: Record<DietMarkKind, { label: string; color: string }> = {
  veg: { label: "Vegetarian", color: "#1a8f3c" },
  egg: { label: "Contains egg", color: "#b36b00" },
  "non-veg": { label: "Non-vegetarian", color: "#c0392b" },
};

/** The familiar square with a dot. The label is for screen readers and the tooltip, so colour is not the only signal. */
export function DietMark({ diet }: { diet: string | null | undefined }) {
  const kind = dietMark(diet);
  if (!kind) return null;
  const { label, color } = MARKS[kind];
  return (
    <span role="img" aria-label={label} title={label} className="inline-grid size-[18px] shrink-0 place-items-center rounded-[4px] border-2 bg-white align-[-3px]" style={{ borderColor: color }}>
      <span className="size-2 rounded-full" style={{ background: color }} />
    </span>
  );
}
