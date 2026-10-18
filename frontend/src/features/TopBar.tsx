import type { Profile } from "@/api/types";
import { detailsComplete } from "@/lib/target";

interface Props {
  query: string;
  onQuery: (q: string) => void;
  profile: Profile | null;
  onGoal: () => void;
  count: number;
  onCart: () => void;
  showCartButton: boolean;
  userName?: string;
  onSignOut?: () => void;
}

export function TopBar({ query, onQuery, profile, onGoal, count, onCart, showCartButton, userName, onSignOut }: Props) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-ground/90 backdrop-blur">
      <div className="mx-auto grid max-w-[1560px] grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-3 px-4 py-3 md:px-7 lg:grid-cols-[220px_1fr_auto]">
        <div className="font-display text-2xl font-extrabold tracking-tight">
          Cart Coach
        </div>
        <search className="relative order-last col-span-2 max-w-[620px] lg:order-none lg:col-span-1">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden className="absolute left-3.5 top-3.5 size-5 text-muted">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.5-3.5" />
          </svg>
          <label htmlFor="q" className="sr-only">
            Search products
          </label>
          <input
            id="q"
            type="search"
            value={query}
            onChange={(e) => onQuery(e.target.value)}
            placeholder="Search paneer, cola, chips, oats"
            autoComplete="off"
            className="h-12 w-full rounded-2xl border border-line bg-white pl-11 pr-4"
          />
        </search>
        <div className="flex items-center gap-2.5">
          {userName && onSignOut && (
            <button type="button" onClick={onSignOut} className="hidden min-h-11 rounded-xl px-2 text-sm text-muted underline underline-offset-4 md:block">
              {userName}, sign out
            </button>
          )}
          <button type="button" onClick={onGoal} className="flex h-12 items-center gap-2 rounded-2xl bg-coach-tint px-4 font-bold text-coach">
            Goal
            <span className="hidden font-medium text-ink sm:inline">{profile ? (detailsComplete(profile) ? `${profile.daily_protein_g} g a day` : "Add details") : "Set your goal"}</span>
          </button>
          {showCartButton && (
            <button type="button" onClick={onCart} aria-label={`Open cart, ${count} items`} className="relative grid size-12 place-items-center rounded-2xl bg-ink text-white">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className="size-[22px]">
                <path d="M3 4h2l2.4 11h10.2L20 7H6.2" />
                <circle cx="9" cy="19.5" r="1.5" />
                <circle cx="17" cy="19.5" r="1.5" />
              </svg>
              <span className="absolute -right-1.5 -top-1.5 grid h-[22px] min-w-[22px] place-items-center rounded-full bg-coach px-1.5 text-[13px] font-bold">{count}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
