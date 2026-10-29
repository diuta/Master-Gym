"use server";

import { and, eq, ilike, ne, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import {
  payments,
  productCategories,
  products,
  purchaseItems,
  purchases,
  saleItems,
  sales,
  stockMovements,
  suppliers,
} from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/dal";
import type { ActionResult } from "@/features/membership/validation";
import { formatInvoiceNo, itemsTotal, movingAverage, reverseAverage } from "./logic";
import { getPurchaseDetail, getSaleDetail, type TransactionDetail } from "./queries";
import { lockProducts } from "./stock";
import {
  CreateProductSchema,
  ProductCategorySchema,
  ProductSchema,
  PurchaseSchema,
  SaleSchema,
  SupplierSchema,
  type CreateProductInput,
  type ProductCategoryInput,
  type ProductInput,
  type PurchaseInput,
  type SaleInput,
  type SupplierInput,
} from "./validation";

const OK = { success: true, data: undefined } as const;
const CATEGORY_NOT_FOUND = { message: "Kategori tidak ditemukan." };
const PRODUCT_NOT_FOUND = { message: "Produk tidak ditemukan." };

function revalidateInventory() {
  revalidatePath("/inventory");
}

// Escape LIKE wildcards so ilike is an exact case-insensitive match.
const exactName = (name: string) => name.replace(/[\\%_]/g, "\\$&");

// Case-insensitive match; an active row wins if two differ only in case. Callers decide what to do with an inactive hit.
async function findCategoryByName(name: string, excludeId?: number) {
  const rows = await db
    .select({ id: productCategories.id, isActive: productCategories.isActive })
    .from(productCategories)
    .where(
      and(
        ilike(productCategories.name, exactName(name)),
        excludeId === undefined ? undefined : ne(productCategories.id, excludeId),
      ),
    );
  return rows.find((r) => r.isActive) ?? rows[0];
}

export async function createProductCategoryAction(
  input: ProductCategoryInput,
): Promise<ActionResult> {
  await requireRole("kasir");
  const v = ProductCategorySchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };

  const existing = await findCategoryByName(v.data.name);
  if (existing?.isActive) return { errors: { name: ["Kategori sudah ada."] } };
  if (existing) {
    // A "deleted" used category keeps its unique name; bring it back instead of colliding.
    await db
      .update(productCategories)
      .set({ name: v.data.name, isActive: true, updatedAt: new Date() })
      .where(eq(productCategories.id, existing.id));
  } else {
    await db.insert(productCategories).values({ name: v.data.name });
  }
  revalidateInventory();
  return OK;
}

export async function updateProductCategoryAction(
  id: number,
  input: ProductCategoryInput,
): Promise<ActionResult> {
  await requireRole("kasir");
  const v = ProductCategorySchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };

  const clash = await findCategoryByName(v.data.name, id);
  if (clash?.isActive) return { errors: { name: ["Kategori sudah ada."] } };
  if (clash) {
    return {
      errors: {
        name: [
          "Nama ini dipakai kategori lama yang dihapus. Tambahkan dengan nama itu untuk memakainya lagi.",
        ],
      },
    };
  }

  const updated = await db
    .update(productCategories)
    .set({ name: v.data.name, updatedAt: new Date() })
    .where(and(eq(productCategories.id, id), eq(productCategories.isActive, true)))
    .returning({ id: productCategories.id });
  if (updated.length === 0) return CATEGORY_NOT_FOUND;

  revalidateInventory();
  return OK;
}

// Categories with products are only deactivated so history keeps its FK.
export async function deleteProductCategoryAction(id: number): Promise<ActionResult> {
  await requireRole("kasir");

  const [used] = await db
    .select({ id: products.id })
    .from(products)
    .where(eq(products.categoryId, id))
    .limit(1);

  const result = used
    ? await db
        .update(productCategories)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(productCategories.id, id), eq(productCategories.isActive, true)))
        .returning({ id: productCategories.id })
    : await db
        .delete(productCategories)
        .where(and(eq(productCategories.id, id), eq(productCategories.isActive, true)))
        .returning({ id: productCategories.id });
  if (result.length === 0) return CATEGORY_NOT_FOUND;

  revalidateInventory();
  return OK;
}

async function categoryIsActive(id: number) {
  const [c] = await db
    .select({ id: productCategories.id })
    .from(productCategories)
    .where(and(eq(productCategories.id, id), eq(productCategories.isActive, true)))
    .limit(1);
  return c !== undefined;
}

export async function createProductAction(input: CreateProductInput): Promise<ActionResult> {
  await requireRole("kasir");
  const v = CreateProductSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };
  const d = v.data;
  if (!(await categoryIsActive(d.categoryId))) return { message: "Kategori tidak aktif." };

  await db.transaction(async (tx) => {
    const [p] = await tx
      .insert(products)
      .values({
        name: d.name,
        categoryId: d.categoryId,
        unit: d.unit,
        salePrice: String(d.salePrice),
        minStock: d.minStock,
        avgCost: (d.initialStock > 0 ? d.costPrice : 0).toFixed(4),
      })
      .returning({ id: products.id });
    if (d.initialStock > 0) {
      await tx
        .insert(stockMovements)
        .values({ productId: p.id, qtyDelta: d.initialStock, type: "initial" });
    }
  });

  revalidateInventory();
  return OK;
}

// Stock and avg cost change only through movements, never through this form.
export async function updateProductAction(id: number, input: ProductInput): Promise<ActionResult> {
  await requireRole("kasir");
  const v = ProductSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };
  if (!(await categoryIsActive(v.data.categoryId))) return { message: "Kategori tidak aktif." };

  const updated = await db
    .update(products)
    .set({
      name: v.data.name,
      categoryId: v.data.categoryId,
      unit: v.data.unit,
      salePrice: String(v.data.salePrice),
      minStock: v.data.minStock,
      updatedAt: new Date(),
    })
    .where(and(eq(products.id, id), eq(products.isActive, true)))
    .returning({ id: products.id });
  if (updated.length === 0) return PRODUCT_NOT_FOUND;

  revalidateInventory();
  return OK;
}

// Products with any history are only deactivated so movements and documents keep their FK.
export async function deleteProductAction(id: number): Promise<ActionResult> {
  await requireRole("kasir");

  const result = await db.transaction(async (tx): Promise<ActionResult> => {
    const p = (await lockProducts(tx, [id])).get(id);
    if (!p || !p.isActive) return PRODUCT_NOT_FOUND;
    if (p.stock > 0) return { message: "Stok masih ada." };

    const [[move], [sold], [bought]] = await Promise.all([
      tx.select({ id: stockMovements.id }).from(stockMovements).where(eq(stockMovements.productId, id)).limit(1),
      tx.select({ id: saleItems.id }).from(saleItems).where(eq(saleItems.productId, id)).limit(1),
      tx.select({ id: purchaseItems.id }).from(purchaseItems).where(eq(purchaseItems.productId, id)).limit(1),
    ]);
    if (move || sold || bought) {
      await tx
        .update(products)
        .set({ isActive: false, updatedAt: new Date() })
        .where(eq(products.id, id));
    } else {
      await tx.delete(products).where(eq(products.id, id));
    }
    return OK;
  });

  if (result.success) revalidateInventory();
  return result;
}

// Thrown inside the transaction so it rolls back; caught below and returned as a message.
class SaleError extends Error {}

export async function createSaleAction(
  input: SaleInput,
): Promise<ActionResult<{ invoiceNo: string }>> {
  await requireRole("kasir");
  const v = SaleSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };
  const d = v.data;

  try {
    const invoiceNo = await db.transaction(async (tx) => {
      const locked = await lockProducts(tx, d.items.map((i) => i.productId));
      const lines = d.items.map((i) => {
        const p = locked.get(i.productId);
        if (!p || !p.isActive) throw new SaleError("Produk tidak aktif.");
        if (p.salePrice !== i.unitPrice) throw new SaleError("Harga sudah berubah, muat ulang halaman.");
        if (p.stock < i.qty) throw new SaleError(`Stok ${p.name} tidak cukup: tersedia ${p.stock}.`);
        return { p, qty: i.qty };
      });
      // The prices were just verified against the DB, so a mismatch means stale client state.
      const total = itemsTotal(lines.map((l) => ({ qty: l.qty, unitPrice: l.p.salePrice })));
      if (total !== d.total) throw new SaleError("Harga sudah berubah, muat ulang halaman.");

      const seq = await tx.execute<{ n: string }>(sql`select nextval('sale_no_seq') as n`);
      const invoiceNo = formatInvoiceNo("PJ", Number(seq.rows[0].n));
      const [sale] = await tx
        .insert(sales)
        .values({
          invoiceNo,
          buyerName: d.buyerName,
          date: d.date,
          notes: d.notes,
          total: String(total),
        })
        .returning({ id: sales.id });
      const items = await tx
        .insert(saleItems)
        .values(
          lines.map((l) => ({
            saleId: sale.id,
            productId: l.p.id,
            productName: l.p.name,
            unit: l.p.unit,
            qty: l.qty,
            unitPrice: String(l.p.salePrice),
            unitCost: l.p.avgCost.toFixed(4),
            lineTotal: String(l.qty * l.p.salePrice),
          })),
        )
        .returning({ id: saleItems.id, productId: saleItems.productId });
      await tx.insert(stockMovements).values(
        items.map((it) => ({
          productId: it.productId,
          qtyDelta: -lines.find((l) => l.p.id === it.productId)!.qty,
          type: "sale" as const,
          saleItemId: it.id,
        })),
      );
      await tx.insert(payments).values(
        d.payments.map((p) => ({ saleId: sale.id, method: p.method, amount: String(p.amount) })),
      );
      return invoiceNo;
    });

    revalidatePath("/inventory");
    revalidatePath("/sales/history");
    return { success: true, data: { invoiceNo } };
  } catch (err) {
    if (err instanceof SaleError) return { message: err.message };
    throw err;
  }
}

const SUPPLIER_NOT_FOUND = { message: "Supplier tidak ditemukan." };

// Case-insensitive match; an active row wins if two differ only in case. Callers decide what to do with an inactive hit.
async function findSupplierByName(name: string, excludeId?: number) {
  const rows = await db
    .select({ id: suppliers.id, isActive: suppliers.isActive })
    .from(suppliers)
    .where(
      and(
        ilike(suppliers.name, exactName(name)),
        excludeId === undefined ? undefined : ne(suppliers.id, excludeId),
      ),
    );
  return rows.find((r) => r.isActive) ?? rows[0];
}

export async function createSupplierAction(input: SupplierInput): Promise<ActionResult> {
  await requireRole("kasir");
  const v = SupplierSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };

  const existing = await findSupplierByName(v.data.name);
  if (existing?.isActive) return { errors: { name: ["Supplier sudah ada."] } };
  if (existing) {
    // A "deleted" used supplier keeps its unique name; bring it back instead of colliding.
    await db
      .update(suppliers)
      .set({ name: v.data.name, phone: v.data.phone, isActive: true, updatedAt: new Date() })
      .where(eq(suppliers.id, existing.id));
  } else {
    await db.insert(suppliers).values({ name: v.data.name, phone: v.data.phone });
  }
  revalidatePurchases();
  return OK;
}

export async function updateSupplierAction(
  id: number,
  input: SupplierInput,
): Promise<ActionResult> {
  await requireRole("kasir");
  const v = SupplierSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };

  const clash = await findSupplierByName(v.data.name, id);
  if (clash?.isActive) return { errors: { name: ["Supplier sudah ada."] } };
  if (clash) {
    return {
      errors: {
        name: [
          "Nama ini dipakai supplier lama yang dihapus. Tambahkan dengan nama itu untuk memakainya lagi.",
        ],
      },
    };
  }

  const updated = await db
    .update(suppliers)
    .set({ name: v.data.name, phone: v.data.phone, updatedAt: new Date() })
    .where(and(eq(suppliers.id, id), eq(suppliers.isActive, true)))
    .returning({ id: suppliers.id });
  if (updated.length === 0) return SUPPLIER_NOT_FOUND;

  revalidatePurchases();
  return OK;
}

// Suppliers used by a purchase are only deactivated so history keeps its FK.
export async function deleteSupplierAction(id: number): Promise<ActionResult> {
  await requireRole("kasir");

  const [used] = await db
    .select({ id: purchases.id })
    .from(purchases)
    .where(eq(purchases.supplierId, id))
    .limit(1);

  const result = used
    ? await db
        .update(suppliers)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(suppliers.id, id), eq(suppliers.isActive, true)))
        .returning({ id: suppliers.id })
    : await db
        .delete(suppliers)
        .where(and(eq(suppliers.id, id), eq(suppliers.isActive, true)))
        .returning({ id: suppliers.id });
  if (result.length === 0) return SUPPLIER_NOT_FOUND;

  revalidatePurchases();
  return OK;
}

function revalidatePurchases() {
  revalidatePath("/purchases/new");
}

class PurchaseError extends Error {}

export async function createPurchaseAction(
  input: PurchaseInput,
): Promise<ActionResult<{ invoiceNo: string }>> {
  await requireRole("kasir");
  const v = PurchaseSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };
  const d = v.data;

  try {
    const invoiceNo = await db.transaction(async (tx) => {
      const [supplier] = await tx
        .select({ id: suppliers.id, name: suppliers.name, isActive: suppliers.isActive })
        .from(suppliers)
        .where(eq(suppliers.id, d.supplierId))
        .limit(1);
      if (!supplier || !supplier.isActive) throw new PurchaseError("Supplier tidak aktif.");

      const locked = await lockProducts(tx, d.items.map((i) => i.productId));
      const lines = d.items.map((i) => {
        const p = locked.get(i.productId);
        if (!p || !p.isActive) throw new PurchaseError("Produk tidak aktif.");
        return { p, qty: i.qty, unitCost: i.unitCost };
      });

      // One line per product (schema forbids duplicates), so the locked stock is current.
      for (const l of lines) {
        await tx
          .update(products)
          .set({
            avgCost: movingAverage(l.p.stock, l.p.avgCost, l.qty, l.unitCost).toFixed(4),
            updatedAt: new Date(),
          })
          .where(eq(products.id, l.p.id));
      }

      const seq = await tx.execute<{ n: string }>(sql`select nextval('purchase_no_seq') as n`);
      const invoiceNo = formatInvoiceNo("PB", Number(seq.rows[0].n));
      const [purchase] = await tx
        .insert(purchases)
        .values({
          invoiceNo,
          supplierId: supplier.id,
          supplierName: supplier.name,
          date: d.date,
          notes: d.notes,
          total: String(d.total),
        })
        .returning({ id: purchases.id });
      const items = await tx
        .insert(purchaseItems)
        .values(
          lines.map((l) => ({
            purchaseId: purchase.id,
            productId: l.p.id,
            productName: l.p.name,
            unit: l.p.unit,
            qty: l.qty,
            unitCost: String(l.unitCost),
            lineTotal: String(l.qty * l.unitCost),
          })),
        )
        .returning({ id: purchaseItems.id, productId: purchaseItems.productId });
      await tx.insert(stockMovements).values(
        items.map((it) => ({
          productId: it.productId,
          qtyDelta: lines.find((l) => l.p.id === it.productId)!.qty,
          type: "purchase" as const,
          purchaseItemId: it.id,
        })),
      );
      await tx.insert(payments).values(
        d.payments.map((p) => ({ purchaseId: purchase.id, method: p.method, amount: String(p.amount) })),
      );
      return invoiceNo;
    });

    revalidatePath("/inventory");
    revalidatePath("/purchases/history");
    return { success: true, data: { invoiceNo } };
  } catch (err) {
    if (err instanceof PurchaseError) return { message: err.message };
    throw err;
  }
}

export async function saleDetailAction(id: number): Promise<ActionResult<TransactionDetail>> {
  await requireRole("kasir", "superadmin");
  const d = await getSaleDetail(Number(id));
  return d ? { success: true, data: d } : { message: "Transaksi tidak ditemukan." };
}

export async function purchaseDetailAction(id: number): Promise<ActionResult<TransactionDetail>> {
  await requireRole("kasir", "superadmin");
  const d = await getPurchaseDetail(Number(id));
  return d ? { success: true, data: d } : { message: "Transaksi tidak ditemukan." };
}

const ALREADY_CANCELLED = "Transaksi ini sudah dibatalkan.";

export async function cancelSaleAction(id: number): Promise<ActionResult> {
  await requireRole("superadmin");
  try {
    await db.transaction(async (tx) => {
      const [sale] = await tx
        .select({ status: sales.status })
        .from(sales)
        .where(eq(sales.id, id))
        .for("update");
      if (!sale) throw new SaleError("Transaksi tidak ditemukan.");
      if (sale.status === "cancelled") throw new SaleError(ALREADY_CANCELLED);

      const items = await tx
        .select({ id: saleItems.id, productId: saleItems.productId, qty: saleItems.qty })
        .from(saleItems)
        .where(eq(saleItems.saleId, id));
      // Lock only for ordering against concurrent writers; inactive products still get stock back.
      await lockProducts(tx, items.map((i) => i.productId));
      await tx.insert(stockMovements).values(
        items.map((i) => ({
          productId: i.productId,
          qtyDelta: i.qty,
          type: "sale_cancel" as const,
          saleItemId: i.id,
        })),
      );
      await tx
        .update(sales)
        .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
        .where(eq(sales.id, id));
    });
  } catch (err) {
    if (err instanceof SaleError) return { message: err.message };
    throw err;
  }
  revalidatePath("/inventory");
  revalidatePath("/sales/history");
  return OK;
}

export async function cancelPurchaseAction(id: number): Promise<ActionResult> {
  await requireRole("superadmin");
  try {
    await db.transaction(async (tx) => {
      const [purchase] = await tx
        .select({ status: purchases.status })
        .from(purchases)
        .where(eq(purchases.id, id))
        .for("update");
      if (!purchase) throw new PurchaseError("Transaksi tidak ditemukan.");
      if (purchase.status === "cancelled") throw new PurchaseError(ALREADY_CANCELLED);

      const items = await tx
        .select({
          id: purchaseItems.id,
          productId: purchaseItems.productId,
          qty: purchaseItems.qty,
          unitCost: purchaseItems.unitCost,
        })
        .from(purchaseItems)
        .where(eq(purchaseItems.purchaseId, id));
      const locked = await lockProducts(tx, items.map((i) => i.productId));

      // Check everything before writing so a blocked cancel changes nothing.
      for (const i of items) {
        const p = locked.get(i.productId);
        if (!p) throw new PurchaseError("Produk tidak ditemukan.");
        if (p.stock < i.qty) {
          throw new PurchaseError(
            `Stok ${p.name} tidak cukup untuk dibatalkan, sebagian sudah terjual.`,
          );
        }
      }
      for (const i of items) {
        const p = locked.get(i.productId)!;
        await tx
          .update(products)
          .set({
            avgCost: reverseAverage(p.stock, p.avgCost, i.qty, Number(i.unitCost)).toFixed(4),
            updatedAt: new Date(),
          })
          .where(eq(products.id, p.id));
      }
      await tx.insert(stockMovements).values(
        items.map((i) => ({
          productId: i.productId,
          qtyDelta: -i.qty,
          type: "purchase_cancel" as const,
          purchaseItemId: i.id,
        })),
      );
      await tx
        .update(purchases)
        .set({ status: "cancelled", cancelledAt: new Date(), updatedAt: new Date() })
        .where(eq(purchases.id, id));
    });
  } catch (err) {
    if (err instanceof PurchaseError) return { message: err.message };
    throw err;
  }
  revalidatePath("/inventory");
  revalidatePath("/purchases/history");
  return OK;
}
