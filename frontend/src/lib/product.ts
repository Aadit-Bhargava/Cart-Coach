import type { Product } from "@/api/types";

/** A catalog product plus the values the UI derives from its name and nutrition. */
export type ProductView = Omit<Product, "brand" | "category"> & {
  brand: string;
  category: string;
  /** Name without brand and pack size, for example "Masala Peanuts". */
  title: string;
  /** "150 g", "10 pcs", or null when the name has no size. */
  packText: string | null;
  /** Pack weight in grams, or null for pieces and millilitres. */
  packG: number | null;
  /** False when the protein value is missing or impossible (over 100 g per 100 g). */
  proteinKnown: boolean;
  /** Protein in the whole pack, or null when it can't be worked out. */
  packProtein: number | null;
  /** Grams of protein per rupee, or null when it can't be worked out. */
  proteinPerRupee: number | null;
};

const SIZE = /(\d+(?:\.\d+)?)\s*(kg|g|ml|L)\b/i;
const COUNT = /\d+\s*(pcs|bags|bars)/i;

export function toView(p: Product): ProductView {
  const brand = p.brand ?? "";
  const size = SIZE.exec(p.name);
  const sizeText = size?.[0] ?? COUNT.exec(p.name)?.[0] ?? "";
  const unit = size?.[2]?.toLowerCase();
  const packG = size ? (unit === "kg" ? Number(size[1]) * 1000 : unit === "g" ? Number(size[1]) : null) : null;
  const proteinKnown = p.protein_g != null && p.protein_g <= 100;
  const packProtein = packG != null && proteinKnown && p.protein_g != null ? (p.protein_g * packG) / 100 : null;
  return {
    ...p,
    brand,
    category: p.category ?? "Other",
    title: p.name.replace(brand, "").replace(sizeText, "").replace(/\s+/g, " ").trim(),
    packText: sizeText ? sizeText.replace(/\s+/, " ") : null,
    packG,
    proteinKnown,
    packProtein,
    proteinPerRupee: packProtein != null && p.price > 0 ? packProtein / p.price : null,
  };
}
