import { dietMark, type DietMarkKind } from "@/lib/diet";

const MARKS: Record<DietMarkKind, { label: string; color: string }> = {
  veg: { label: "Vegetarian", color: "#1a8f3c" },
  egg: { label: "Contains egg", color: "#b36b00" },
  "non-veg": { label: "Non-vegetarian", color: "#c0392b" },
};

/** The familiar square with a dot. Put it in a flex row beside the name and give it a small top margin so it lines up with the first line of text. The label is for screen readers and the tooltip, so colour is not the only signal. */
export function DietMark({ diet, className = "" }: { diet: string | null | undefined; className?: string }) {
  const kind = dietMark(diet);
  if (!kind) return null;
  const { label, color } = MARKS[kind];
  return (
    <span role="img" aria-label={label} title={label} className={`grid size-[18px] shrink-0 place-items-center rounded-[4px] border-2 bg-white ${className}`} style={{ borderColor: color }}>
      <span className="size-2 rounded-full" style={{ background: color }} />
    </span>
  );
}
