// Diet marks and allergen labels. No imports, so Node's test runner can load it directly.
//
// The tags come from the product's name and category (the demo catalog is generated), not from a
// label. The UI says so wherever it lists allergens.

export type DietMarkKind = "veg" | "egg" | "non-veg";

/** The mark to show for a product's diet. Unknown or missing diets get no mark. */
export function dietMark(diet: string | null | undefined): DietMarkKind | null {
  return diet === "veg" || diet === "egg" || diet === "non-veg" ? diet : null;
}

/** Vegan means vegetarian with no dairy, egg or honey. */
export function isVegan(p: { diet?: string | null; allergens?: readonly string[] | null }): boolean {
  const tags = p.allergens ?? [];
  return p.diet === "veg" && !tags.includes("dairy") && !tags.includes("egg") && !tags.includes("honey");
}

const LABELS: Record<string, string> = {
  peanuts: "Peanuts",
  "tree-nuts": "Tree nuts",
  dairy: "Dairy",
  egg: "Egg",
  gluten: "Gluten",
  soy: "Soy",
  fish: "Fish",
  honey: "Honey",
};

/** Readable names for the tags we know, in the order given. Unknown tags are dropped. */
export function allergenLabels(allergens: readonly string[] | null | undefined): string[] {
  return (allergens ?? []).flatMap((a) => (LABELS[a] ? [LABELS[a]] : []));
}
