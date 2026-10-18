import { useMemo } from "react";
import type { ProductView } from "@/lib/product";
import { useStore, type Line } from "./store";

export interface CartLine {
  product: ProductView;
  line: Line;
}

export interface CartView {
  user: CartLine[];
  coach: CartLine[];
  count: number;
  total: number;
  /** Protein from the user's own items, in grams. */
  userProtein: number;
  coachProtein: number;
  /** Items in the cart with no protein per pack, so they aren't counted. */
  unknownProtein: number;
}

export function useCartView(byId: Map<number, ProductView>): CartView {
  const { lines } = useStore();
  return useMemo(() => {
    const view: CartView = { user: [], coach: [], count: 0, total: 0, userProtein: 0, coachProtein: 0, unknownProtein: 0 };
    for (const [id, line] of Object.entries(lines)) {
      const product = byId.get(Number(id));
      if (!product) continue;
      (line.by === "coach" ? view.coach : view.user).push({ product, line });
      view.count += line.qty;
      view.total += product.price * line.qty;
      if (product.packProtein == null) view.unknownProtein += line.qty;
      else if (line.by === "coach") view.coachProtein += product.packProtein * line.qty;
      else view.userProtein += product.packProtein * line.qty;
    }
    return view;
  }, [lines, byId]);
}
