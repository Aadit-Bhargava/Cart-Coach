import { Button, ProductImage } from "@/components/ui";
import { DietMark } from "@/components/DietMark";
import { Stepper } from "@/components/Stepper";
import { allergenLabels, isVegan } from "@/lib/diet";
import { grams, inr } from "@/lib/format";
import type { ProductView } from "@/lib/product";
import { useDispatch, useStore } from "@/state/store";

export function ProductDetail({ product }: { product: ProductView }) {
  const line = useStore().lines[product.id];
  const dispatch = useDispatch();
  const allergens = allergenLabels(product.allergens);
  const kcalPack = product.packG != null && product.calories != null ? (product.calories * product.packG) / 100 : null;
  return (
    <div className="p-7 pt-6">
      <h2 className="pr-12 font-display text-[1.7rem] font-extrabold leading-[1.1] tracking-tight"><DietMark diet={product.diet} /> {product.title}
      </h2>
      <p className="mt-1.5 text-muted">
        {product.brand}
        {product.packText ? `, ${product.packText}` : ""}
      </p>
      {(isVegan(product) || allergens.length > 0) && (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-sm">
          {isVegan(product) && <span className="rounded-full bg-[#e6f4ea] px-2.5 py-0.5 font-semibold text-[#14632b]">Vegan</span>}
          {allergens.length > 0 && <span>Contains: {allergens.join(", ")}</span>}
        </div>
      )}
      <p className="mt-1.5 text-xs text-muted">Tags are based on the product name and category in our demo data. Check the pack for allergens.</p>
      <ProductImage product={product} className="mt-4 h-[150px] rounded-[18px]" textClass="text-8xl" />

      <div className="mt-4 flex items-center justify-between gap-4">
        <div>
          <div className="font-display text-[1.6rem] font-bold">{inr(product.price)}</div>
          <p className="text-sm text-muted">Demo price. Category: {product.category}.</p>
        </div>
        {line ? (
          <Stepper qty={line.qty} onInc={() => dispatch({ type: "add", id: product.id })} onDec={() => dispatch({ type: "step", id: product.id, delta: -1 })} />
        ) : (
          <Button className="min-w-32" onClick={() => dispatch({ type: "add", id: product.id })}>
            Add
          </Button>
        )}
      </div>

      <h3 className="mt-6 border-t border-line pt-4 font-display text-lg font-bold">Nutrition</h3>
      <div className="mt-3 rounded-2xl bg-coach-tint p-4">
        {product.proteinPerRupee != null && product.packProtein != null ? (
          <>
            <b className="block font-display text-[1.9rem] leading-[1.1] tracking-tight text-coach">{product.proteinPerRupee.toFixed(2)} g protein per ₹</b>
            <span className="text-sm">
              {grams(product.packProtein)} g protein in the pack ÷ {inr(product.price)} demo price
            </span>
          </>
        ) : (
          <>
            <b className="block font-display text-[1.9rem] leading-[1.1] tracking-tight text-coach">Not enough data</b>
            <span className="text-sm">
              {product.proteinKnown ? "This pack isn't sold by weight in grams, so we can't work out protein per ₹." : "This product's protein value looks off, so Coach won't suggest it."}
            </span>
          </>
        )}
      </div>
      <table className="mt-4 w-full border-collapse">
        <thead>
          <tr className="text-left text-sm text-muted">
            <th className="py-1.5 font-medium">Nutrition</th>
            <th className="py-1.5 text-right font-medium">Per 100 g</th>
            <th className="py-1.5 text-right font-medium">Per pack</th>
          </tr>
        </thead>
        <tbody className="font-semibold [&_td]:border-t [&_td]:border-line [&_td]:py-2.5 [&_td:not(:first-child)]:text-right">
          <tr>
            <td>Protein</td>
            <td>{product.proteinKnown && product.protein_g != null ? `${grams(product.protein_g)} g` : "Unknown"}</td>
            <td>{product.packProtein != null ? `${grams(product.packProtein)} g` : "Not enough data"}</td>
          </tr>
          <tr>
            <td>Energy</td>
            <td>{product.calories != null ? `${Math.round(product.calories)} kcal` : "Unknown"}</td>
            <td>{kcalPack != null ? `${Math.round(kcalPack)} kcal` : "Not enough data"}</td>
          </tr>
        </tbody>
      </table>
      <p className="mt-3.5 max-w-[60ch] text-sm text-muted">Demo data: nutrition values are sample values, not measured. Fat, carbohydrate and sugar are not available for this product.</p>
    </div>
  );
}
