export const inr = (n: number): string =>
  "₹" + (Math.round(n * 100) / 100).toLocaleString("en-IN", { maximumFractionDigits: 2 });

export const grams = (n: number): string =>
  (Math.round(n * 10) / 10).toLocaleString("en-IN", { maximumFractionDigits: 1 });

export const plural = (n: number, one: string, many: string): string => `${n} ${n === 1 ? one : many}`;
