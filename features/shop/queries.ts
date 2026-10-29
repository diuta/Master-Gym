import "server-only";
import { and, asc, desc, eq, gte, inArray, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  payments,
  productCategories,
  products,
  purchaseItems,
  purchases,
  saleItems,
  sales,
  suppliers,
} from "@/lib/db/schema";
import type { PaymentMethod } from "@/features/membership/validation";
import { stockStatus } from "./logic";
import { stockSubquery } from "./stock";

export type CategoryOption = { id: number; name: string };

export type SupplierOption = { id: number; name: string; phone: string | null };

export type ProductRow = {
  id: number;
  name: string;
  categoryId: number;
  categoryName: string;
  unit: string;
  stock: number;
  minStock: number;
  salePrice: number;
  avgCost: number;
  stockValue: number;
  status: "out_of_stock" | "low_stock" | "in_stock";
};

export async function listActiveProductCategories(): Promise<CategoryOption[]> {
  return db
    .select({ id: productCategories.id, name: productCategories.name })
    .from(productCategories)
    .where(eq(productCategories.isActive, true))
    .orderBy(asc(productCategories.name));
}

export async function listProducts(): Promise<ProductRow[]> {
  const stock = stockSubquery();
  const rows = await db
    .select({
      id: products.id,
      name: products.name,
      categoryId: products.categoryId,
      categoryName: productCategories.name,
      unit: products.unit,
      stock: stock.stock,
      minStock: products.minStock,
      salePrice: products.salePrice,
      avgCost: products.avgCost,
    })
    .from(products)
    .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
    .leftJoin(stock, eq(stock.productId, products.id))
    .where(eq(products.isActive, true))
    .orderBy(asc(products.name));

  return rows.map((r) => {
    const qty = r.stock ?? 0;
    const avgCost = Number(r.avgCost);
    return {
      ...r,
      stock: qty,
      salePrice: Number(r.salePrice),
      avgCost,
      stockValue: Math.round(qty * avgCost),
      status: stockStatus(qty, r.minStock),
    };
  });
}

export async function listActiveSuppliers(): Promise<SupplierOption[]> {
  return db
    .select({ id: suppliers.id, name: suppliers.name, phone: suppliers.phone })
    .from(suppliers)
    .where(eq(suppliers.isActive, true))
    .orderBy(asc(suppliers.name));
}

type Range = { from?: string; to?: string };
type Status = "success" | "cancelled";

export type SaleRow = {
  id: number;
  invoiceNo: string;
  date: string;
  itemsLabel: string;
  total: number;
  buyerName: string | null;
  methods: PaymentMethod[];
  status: Status;
};

export type PurchaseItemRow = {
  purchaseId: number;
  itemId: number;
  invoiceNo: string;
  date: string;
  productName: string;
  categoryName: string;
  qty: number;
  unitCost: number;
  lineTotal: number;
  supplierName: string;
  methods: PaymentMethod[];
  status: Status;
};

export type TransactionDetail = {
  kind: "sale" | "purchase";
  id: number;
  invoiceNo: string;
  date: string;
  party: string | null;
  notes: string | null;
  status: Status;
  items: { name: string; unit: string; qty: number; unitPrice: number; lineTotal: number }[];
  payments: { method: PaymentMethod; amount: number }[];
  total: number;
};

// Distinct methods per document, in first-seen order.
async function methodsFor(col: "saleId" | "purchaseId", ids: number[]) {
  const map = new Map<number, PaymentMethod[]>();
  if (ids.length === 0) return map;
  const rows = await db
    .select({ ref: payments[col], method: payments.method })
    .from(payments)
    .where(inArray(payments[col], ids))
    .orderBy(asc(payments.id));
  for (const r of rows) {
    const list = map.get(r.ref!) ?? [];
    if (!list.includes(r.method)) list.push(r.method);
    map.set(r.ref!, list);
  }
  return map;
}

export async function listSales(range: Range, productId?: number): Promise<SaleRow[]> {
  const rows = await db
    .select()
    .from(sales)
    .where(
      and(
        range.from ? gte(sales.date, range.from) : undefined,
        range.to ? lte(sales.date, range.to) : undefined,
        productId === undefined
          ? undefined
          : inArray(
              sales.id,
              db.select({ id: saleItems.saleId }).from(saleItems).where(eq(saleItems.productId, productId)),
            ),
      ),
    )
    .orderBy(desc(sales.date), desc(sales.id));
  const ids = rows.map((r) => r.id);
  const [items, methods] = await Promise.all([
    ids.length
      ? db.select().from(saleItems).where(inArray(saleItems.saleId, ids)).orderBy(asc(saleItems.id))
      : [],
    methodsFor("saleId", ids),
  ]);
  const labels = new Map<number, string[]>();
  for (const it of items) {
    const l = labels.get(it.saleId) ?? [];
    l.push(`${it.productName} ×${it.qty}`);
    labels.set(it.saleId, l);
  }
  return rows.map((r) => ({
    id: r.id,
    invoiceNo: r.invoiceNo,
    date: r.date,
    itemsLabel: (labels.get(r.id) ?? []).join(", "),
    total: Number(r.total),
    buyerName: r.buyerName,
    methods: methods.get(r.id) ?? [],
    status: r.status,
  }));
}

export async function listPurchaseItems(range: Range): Promise<PurchaseItemRow[]> {
  const rows = await db
    .select({
      purchaseId: purchases.id,
      itemId: purchaseItems.id,
      invoiceNo: purchases.invoiceNo,
      date: purchases.date,
      productName: purchaseItems.productName,
      categoryName: productCategories.name,
      qty: purchaseItems.qty,
      unitCost: purchaseItems.unitCost,
      lineTotal: purchaseItems.lineTotal,
      supplierName: purchases.supplierName,
      status: purchases.status,
    })
    .from(purchaseItems)
    .innerJoin(purchases, eq(purchases.id, purchaseItems.purchaseId))
    .innerJoin(products, eq(products.id, purchaseItems.productId))
    .innerJoin(productCategories, eq(productCategories.id, products.categoryId))
    .where(
      and(
        range.from ? gte(purchases.date, range.from) : undefined,
        range.to ? lte(purchases.date, range.to) : undefined,
      ),
    )
    .orderBy(desc(purchases.date), desc(purchases.id), asc(purchaseItems.id));
  const methods = await methodsFor("purchaseId", [...new Set(rows.map((r) => r.purchaseId))]);
  return rows.map((r) => ({
    ...r,
    unitCost: Number(r.unitCost),
    lineTotal: Number(r.lineTotal),
    methods: methods.get(r.purchaseId) ?? [],
  }));
}

export async function getSaleDetail(id: number): Promise<TransactionDetail | null> {
  const [s] = await db.select().from(sales).where(eq(sales.id, id)).limit(1);
  if (!s) return null;
  const [items, pays] = await Promise.all([
    db.select().from(saleItems).where(eq(saleItems.saleId, id)).orderBy(asc(saleItems.id)),
    db.select().from(payments).where(eq(payments.saleId, id)).orderBy(asc(payments.id)),
  ]);
  return {
    kind: "sale",
    id,
    invoiceNo: s.invoiceNo,
    date: s.date,
    party: s.buyerName,
    notes: s.notes,
    status: s.status,
    items: items.map((i) => ({
      name: i.productName,
      unit: i.unit,
      qty: i.qty,
      unitPrice: Number(i.unitPrice),
      lineTotal: Number(i.lineTotal),
    })),
    payments: pays.map((p) => ({ method: p.method, amount: Number(p.amount) })),
    total: Number(s.total),
  };
}

export async function getPurchaseDetail(id: number): Promise<TransactionDetail | null> {
  const [p] = await db.select().from(purchases).where(eq(purchases.id, id)).limit(1);
  if (!p) return null;
  const [items, pays] = await Promise.all([
    db.select().from(purchaseItems).where(eq(purchaseItems.purchaseId, id)).orderBy(asc(purchaseItems.id)),
    db.select().from(payments).where(eq(payments.purchaseId, id)).orderBy(asc(payments.id)),
  ]);
  return {
    kind: "purchase",
    id,
    invoiceNo: p.invoiceNo,
    date: p.date,
    party: p.supplierName,
    notes: p.notes,
    status: p.status,
    items: items.map((i) => ({
      name: i.productName,
      unit: i.unit,
      qty: i.qty,
      unitPrice: Number(i.unitCost),
      lineTotal: Number(i.lineTotal),
    })),
    payments: pays.map((x) => ({ method: x.method, amount: Number(x.amount) })),
    total: Number(p.total),
  };
}

export async function listAllProductsForFilter(): Promise<{ id: number; name: string }[]> {
  return db.select({ id: products.id, name: products.name }).from(products).orderBy(asc(products.name));
}
