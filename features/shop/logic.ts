// Pure rules, no server imports: also used by client components.
export function movingAverage(stock: number, avg: number, qty: number, unitCost: number): number {
  if (stock <= 0) return unitCost;
  return (stock * avg + qty * unitCost) / (stock + qty);
}

// Inverse of movingAverage, used when cancelling a purchase. Clamped: rounding or
// later sales can make the exact inverse negative. When the cancel empties stock, keep the
// current average: resetting to 0 would make a later sale-cancel restock units at cost 0
// and later sales record unit_cost 0.
export function reverseAverage(stock: number, avg: number, qty: number, unitCost: number): number {
  const after = stock - qty;
  if (after <= 0) return avg;
  return Math.max(0, (stock * avg - qty * unitCost) / after);
}

export function stockStatus(
  stock: number,
  minStock: number,
): "out_of_stock" | "low_stock" | "in_stock" {
  return stock <= 0 ? "out_of_stock" : stock <= minStock ? "low_stock" : "in_stock";
}

export function itemsTotal(items: { qty: number; unitPrice: number }[]): number {
  return items.reduce((s, i) => s + i.qty * i.unitPrice, 0);
}

export function formatInvoiceNo(prefix: "PJ" | "PB", n: number): string {
  return `${prefix}-${String(n).padStart(4, "0")}`;
}
