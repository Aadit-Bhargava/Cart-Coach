import { Button, ProductImage } from "@/components/ui";
import { DietMark } from "@/components/DietMark";
import { Stepper } from "@/components/Stepper";
import { inr } from "@/lib/format";
import type { ProductView } from "@/lib/product";
import { useDispatch, useStore } from "@/state/store";

/** General information only. Nutrition lives in the product detail and the cart. */
export function ProductCard({ product, onOpen }: { product: ProductView; onOpen: (id: number) => void }) {
  const line = useStore().lines[product.id];
  const dispatch = useDispatch();
  return (
    <article className="flex flex-col rounded-[20px] border border-transparent bg-white p-2.5 pb-3.5 transition-[border-color,box-shadow] hover:border-line hover:shadow-[0_10px_28px_rgb(27_27_58/0.08)]">
      <button type="button" onClick={() => onOpen(product.id)} aria-label={`${product.name}: open details`} className="flex-1 text-left">
        <ProductImage product={product} className="aspect-[1/0.82] w-full rounded-2xl" />
        <div className="px-1.5 pt-3">
          <div className="text-[13px] text-muted">{product.brand}</div>
          <div className="flex min-h-[2.6em] items-start gap-1.5 font-semibold leading-[1.3]">
            <DietMark diet={product.diet} className="mt-px" />
            <span className="line-clamp-2">{product.title}</span>
          </div>
          <div className="mt-0.5 text-sm text-muted">{product.packText}</div>
        </div>
      </button>
      <div className="flex items-center justify-between px-1.5 pt-3 max-sm:flex-col max-sm:items-stretch max-sm:gap-2">
        <span className="font-display text-xl font-bold">{inr(product.price)}</span>
        {line ? (
          <Stepper qty={line.qty} onInc={() => dispatch({ type: "add", id: product.id })} onDec={() => dispatch({ type: "step", id: product.id, delta: -1 })} />
        ) : (
          <Button aria-label={`Add ${product.name}`} onClick={() => dispatch({ type: "add", id: product.id })}>
            Add
          </Button>
        )}
      </div>
    </article>
  );
}
