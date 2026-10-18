import { useMemo, useState } from "react";
import { Dialog } from "@/components/Dialog";
import { ToastProvider, useToast } from "@/components/Toast";
import { LinkButton } from "@/components/ui";
import { useMediaQuery } from "@/lib/useMediaQuery";
import { useCartView } from "@/state/cart";
import { useCatalog } from "@/state/catalog";
import { CoachProvider } from "@/state/coach";
import { StoreProvider, useStore } from "@/state/store";
import { Session } from "@/features/Session";
import { useAuth } from "@/state/auth";
import { CartPanel } from "@/features/CartPanel";
import { CategoryNav } from "@/features/CategoryNav";
import { GoalContent, type GoalMode } from "@/features/GoalDialog";
import { SignInContent } from "@/features/SignIn";
import { LogContent } from "@/features/LogDialog";
import { ProductCard } from "@/features/ProductCard";
import { ProductDetail } from "@/features/ProductDetail";
import { TopBar } from "@/features/TopBar";
import { whatToDo } from "@/lib/errors";
import { detailsComplete } from "@/lib/target";
import { inr, plural } from "@/lib/format";

type Overlay = { kind: "product"; id: number } | { kind: "goal"; first: boolean; mode: GoalMode } | { kind: "log" } | { kind: "signin" } | null;
type Sort = "featured" | "low" | "high" | "az";
const PAGE = 60;

export function App() {
  return (
    <StoreProvider>
      <ToastProvider>
        <Session>
          <CoachProvider>
            <Shop />
          </CoachProvider>
        </Session>
      </ToastProvider>
    </StoreProvider>
  );
}

function Shop() {
  const { profile } = useStore();
  const auth = useAuth();
  const toast = useToast();
  const { products, byId, status, error, retry } = useCatalog();
  const cart = useCartView(byId);
  const wide = useMediaQuery("(min-width: 1280px)");

  const [overlay, setOverlay] = useState<Overlay>(null);
  const [firstRunSeen, setFirstRunSeen] = useState(false);
  const [detailsSkipped, setDetailsSkipped] = useState(false);
  const [railOpen, setRailOpen] = useState(false);
  const [category, setCategory] = useState("All");
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<Sort>("featured");
  const [shown, setShown] = useState(PAGE);

  // Not signed in: the sign-in popup sits over the homepage and cannot be dismissed.
  // Then the goal popup greets a new user once; it stays up until they save or skip.
  const needsSignIn = auth.status === "signedOut" || auth.status === "error";
  // An account saved before age, weight and height were asked is asked once for them.
  const needsDetails = auth.ready && Boolean(profile) && !detailsComplete(profile!) && !detailsSkipped;
  const activeOverlay: Overlay = needsSignIn
    ? { kind: "signin" }
    : (overlay ??
      (needsDetails
        ? { kind: "goal", first: false, mode: "details" }
        : !firstRunSeen && !profile && auth.ready && status === "success"
          ? { kind: "goal", first: true, mode: "full" }
          : null));
  const closeOverlay = () => {
    setFirstRunSeen(true);
    setDetailsSkipped(true);
    setOverlay(null);
  };

  const categories = useMemo(() => {
    const counts = new Map<string, number>();
    for (const p of products) counts.set(p.category, (counts.get(p.category) ?? 0) + 1);
    return [...counts].map(([name, count]) => ({ name, count })).sort((a, b) => a.name.localeCompare(b.name));
  }, [products]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = products.filter((p) => (category === "All" || p.category === category) && (!q || p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q)));
    if (sort === "low") list.sort((a, b) => a.price - b.price);
    if (sort === "high") list.sort((a, b) => b.price - a.price);
    if (sort === "az") list.sort((a, b) => a.name.localeCompare(b.name));
    return list;
  }, [products, category, query, sort]);

  const product = activeOverlay?.kind === "product" ? byId.get(activeOverlay.id) : undefined;
  const openDetails = () => setOverlay({ kind: "goal", first: false, mode: "details" });
  const openGoal = () => setOverlay({ kind: "goal", first: false, mode: "full" });
  const openLog = () => setOverlay({ kind: "log" });
  const resetPage = () => setShown(PAGE);

  return (
    <>
      <TopBar
        query={query}
        onQuery={(q) => {
          setQuery(q);
          resetPage();
        }}
        profile={profile}
        onGoal={openGoal}
        count={cart.count}
        onCart={() => setRailOpen(true)}
        showCartButton={!wide}
        userName={auth.user?.name}
        onSignOut={auth.signOut}
      />

      <div className="mx-auto grid max-w-[1560px] gap-4 px-4 pb-24 pt-5 md:px-7 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-7 xl:grid-cols-[220px_minmax(0,1fr)_400px]">
        <CategoryNav
          categories={categories}
          total={products.length}
          selected={category}
          onSelect={(c) => {
            setCategory(c);
            resetPage();
          }}
        />

        <main className="min-w-0">
          <div className="mb-4 flex items-end justify-between gap-4">
            <div>
              <h1 className="font-display text-3xl font-extrabold leading-[1.05] tracking-tight md:text-[2.1rem]">{category === "All" ? "All products" : category}</h1>
              <p className="mt-1 text-muted" aria-live="polite">
                {status === "success" ? `${plural(visible.length, "product", "products")}${query ? ` matching "${query}"` : ""}` : ""}
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm text-muted">
              <span className="max-sm:sr-only">Sort by</span>
              <select value={sort} onChange={(e) => setSort(e.target.value as Sort)} className="h-11 rounded-xl border border-line bg-white px-3 text-ink">
                <option value="featured">Featured</option>
                <option value="low">Price, low to high</option>
                <option value="high">Price, high to low</option>
                <option value="az">Name, A to Z</option>
              </select>
            </label>
          </div>

          {status === "pending" && <p role="status" className="rounded-2xl bg-white p-10 text-center text-muted">Loading products...</p>}
          {status === "error" && (
            <div role="alert" className="rounded-2xl bg-white p-10 text-center">
              <b className="block font-display text-lg">Products didn't load</b>
              <span className="text-muted">{whatToDo(error)}</span>
              <div>
                <LinkButton onClick={retry}>Try again</LinkButton>
              </div>
            </div>
          )}
          {status === "success" && visible.length === 0 && (
            <div className="rounded-2xl bg-white p-10 text-center text-muted">
              <b className="block font-display text-lg text-ink">No products match "{query}"</b>
              Try a different word or clear the search.
            </div>
          )}
          <div className="grid grid-cols-[repeat(auto-fill,minmax(200px,1fr))] gap-[18px] max-sm:grid-cols-2 max-sm:gap-3">
            {visible.slice(0, shown).map((p) => (
              <ProductCard key={p.id} product={p} onOpen={(id) => setOverlay({ kind: "product", id })} />
            ))}
          </div>
          {visible.length > shown && (
            <div className="mt-6 text-center">
              <LinkButton onClick={() => setShown((n) => n + PAGE)}>Show more ({visible.length - shown} left)</LinkButton>
            </div>
          )}
        </main>

        {wide && (
          <aside aria-label="Your cart" className="sticky top-[92px] self-start">
            <CartPanel byId={byId} onGoal={openGoal} onDetails={openDetails} onLog={openLog} className="max-h-[calc(100dvh-112px)]" />
          </aside>
        )}
      </div>

      <p className="mx-auto max-w-[1560px] px-4 pb-10 text-sm text-muted md:px-7">
        Product and nutrition data is demo data, and prices are demo prices. Cart Coach gives food information, not medical or dietary advice.
      </p>

      {!wide && (
        <div className="fixed inset-x-3 bottom-3 z-10 flex items-center justify-between gap-3 rounded-[18px] bg-ink py-2.5 pl-[18px] pr-2.5 text-white">
          <div className="font-bold">
            {cart.count ? `${plural(cart.count, "item", "items")} · ${inr(cart.total)}` : "Cart is empty"}
            {profile && <small className="block font-medium text-[#c9c9e4]">{Math.round(cart.userProtein + cart.coachProtein)} of {profile.protein_target_g} g protein</small>}
          </div>
          <button type="button" onClick={() => setRailOpen(true)} className="h-12 rounded-xl bg-white px-5 font-bold text-ink">
            View cart
          </button>
        </div>
      )}

      {!wide && (
        <Dialog open={railOpen} onClose={() => setRailOpen(false)} variant="side" label="Your cart">
          <CartPanel
            byId={byId}
            onGoal={() => {
              setRailOpen(false);
              openGoal();
            }}
            onDetails={() => {
              setRailOpen(false);
              openDetails();
            }}
            onLog={() => {
              setRailOpen(false);
              openLog();
            }}
            className="h-[calc(100dvh-24px)] max-sm:h-[88dvh]"
          />
        </Dialog>
      )}

      <Dialog open={activeOverlay?.kind === "product" && Boolean(product)} onClose={closeOverlay} variant="side" label="Product details">
        {product && <ProductDetail product={product} />}
      </Dialog>
      <Dialog open={activeOverlay?.kind === "signin"} onClose={() => undefined} variant="center" label="Sign in" dismissable={false} blurBackdrop>
        <SignInContent />
      </Dialog>
      <Dialog open={activeOverlay?.kind === "log"} onClose={closeOverlay} variant="side" label="Decision log">
        <LogContent />
      </Dialog>
      <Dialog open={activeOverlay?.kind === "goal"} onClose={closeOverlay} variant="center" label="Your goal" dismissable={activeOverlay?.kind === "goal" && !activeOverlay.first}>
        {activeOverlay?.kind === "goal" && (
          <GoalContent
            first={activeOverlay.first}
            mode={activeOverlay.mode}
            onDone={(saved) => {
              if (!saved) toast("You can set a goal any time from the top bar.");
              closeOverlay();
            }}
          />
        )}
      </Dialog>
    </>
  );
}
