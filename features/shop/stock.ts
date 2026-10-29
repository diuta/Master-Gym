import "server-only";
import { inArray, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { products, stockMovements } from "@/lib/db/schema";

// Wider than getMemberSummary's Pick<typeof db, "select">: we need .for("update").
export type Executor = Parameters<Parameters<typeof db.transaction>[0]>[0];

export type LockedProduct = {
  id: number;
  name: string;
  unit: string;
  salePrice: number;
  avgCost: number;
  isActive: boolean;
  stock: number;
};

// Ascending id order makes concurrent transactions lock in the same order (no deadlocks).
// Stock is summed only after the lock, so it sees every committed movement.
export async function lockProducts(
  tx: Executor,
  ids: number[],
): Promise<Map<number, LockedProduct>> {
  const sorted = [...new Set(ids)].sort((a, b) => a - b);
  const result = new Map<number, LockedProduct>();
  if (sorted.length === 0) return result;

  const rows = await tx
    .select()
    .from(products)
    .where(inArray(products.id, sorted))
    .orderBy(products.id)
    .for("update");

  const sums = await tx
    .select({
      productId: stockMovements.productId,
      stock: sql<number>`coalesce(sum(${stockMovements.qtyDelta}), 0)::int`,
    })
    .from(stockMovements)
    .where(inArray(stockMovements.productId, sorted))
    .groupBy(stockMovements.productId);
  const stockById = new Map(sums.map((s) => [s.productId, s.stock]));

  for (const r of rows) {
    result.set(r.id, {
      id: r.id,
      name: r.name,
      unit: r.unit,
      salePrice: Number(r.salePrice),
      avgCost: Number(r.avgCost),
      isActive: r.isActive,
      stock: stockById.get(r.id) ?? 0,
    });
  }
  return result;
}

// Left-join this in list queries: .leftJoin(stock, eq(stock.productId, products.id)).
export function stockSubquery() {
  return db
    .select({
      productId: stockMovements.productId,
      stock: sql<number>`coalesce(sum(${stockMovements.qtyDelta}), 0)::int`.as("stock"),
    })
    .from(stockMovements)
    .groupBy(stockMovements.productId)
    .as("stock");
}
