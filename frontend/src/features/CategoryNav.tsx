import { cx } from "@/components/ui";

export interface CategoryCount {
  name: string;
  count: number;
}

export function CategoryNav({ categories, total, selected, onSelect }: { categories: CategoryCount[]; total: number; selected: string; onSelect: (c: string) => void }) {
  const all: CategoryCount[] = [{ name: "All", count: total }, ...categories];
  return (
    <nav aria-label="Categories" className="min-w-0 lg:sticky lg:top-[92px] lg:max-h-[calc(100dvh-110px)] lg:overflow-y-auto">
      <h2 className="mb-2 ml-3 hidden font-display text-base font-bold text-muted lg:block">Shop by category</h2>
      <ul className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:none] lg:grid lg:gap-0.5 lg:overflow-visible">
        {all.map((c) => (
          <li key={c.name}>
            <button
              type="button"
              aria-pressed={selected === c.name}
              onClick={() => onSelect(c.name)}
              className={cx(
                "flex min-h-11 w-full items-center justify-between gap-2 whitespace-nowrap rounded-full lg:whitespace-normal px-4 py-2 text-left font-medium lg:rounded-xl lg:px-3",
                selected === c.name ? "bg-ink text-white" : "bg-white hover:bg-ink/5 lg:bg-transparent",
              )}
            >
              {c.name}
              <span className={cx("text-sm", selected === c.name ? "text-[#c9c9e4]" : "text-muted")}>{c.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
