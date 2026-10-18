import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { api } from "@/api";
import { toView, type ProductView } from "@/lib/product";

export function useCatalog() {
  const query = useQuery({
    queryKey: ["products"],
    queryFn: () => api.listProducts(),
    staleTime: Infinity,
    select: (products) => products.map(toView),
  });
  const byId = useMemo(() => new Map<number, ProductView>((query.data ?? []).map((p) => [p.id, p])), [query.data]);
  return { products: query.data ?? [], byId, status: query.status, error: query.error, retry: () => void query.refetch() };
}
