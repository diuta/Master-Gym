import * as z from "zod";
import { normalizePhone, paymentsMatchPrice, todayWib } from "@/features/membership/logic";
import { PaymentsSchema } from "@/features/membership/validation";
import { itemsTotal } from "./logic";

// "Today" is evaluated at parse time: the server process outlives a day.
export const DateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Tanggal tidak valid.", abort: true })
  // Round-trip catches impossible dates like 2020-02-31; abort so junk never gets the future message.
  .refine((v) => {
    const t = Date.parse(`${v}T00:00:00Z`);
    return !Number.isNaN(t) && new Date(t).toISOString().slice(0, 10) === v;
  }, { error: "Tanggal tidak valid.", abort: true })
  .refine((v) => v <= todayWib(), { error: "Tanggal tidak boleh di masa depan." });

const optionalText = (max: number, label: string) =>
  z
    .string()
    .trim()
    .max(max, { error: `${label} maksimal ${max} karakter.` })
    .transform((v) => (v === "" ? null : v));

const whole = (label: string, min: number) =>
  z.number({ error: `${label} wajib diisi.` }).int().min(min, { error: `${label} minimal ${min}.` });

// Cap keeps amounts inside decimal(14,2), so an absurd value fails here, not in the DB.
const rupiah = (label: string, min: number) =>
  whole(label, min).max(1_000_000_000, { error: `${label} maksimal Rp1.000.000.000.` });

export const ProductCategorySchema = z.object({
  name: z.string().trim().min(1, { error: "Nama kategori wajib diisi." }).max(100, { error: "Nama kategori maksimal 100 karakter." }),
});
export type ProductCategoryInput = z.input<typeof ProductCategorySchema>;

export const ProductSchema = z.object({
  name: z.string().trim().min(1, { error: "Nama produk wajib diisi." }).max(100, { error: "Nama produk maksimal 100 karakter." }),
  categoryId: z.number({ error: "Kategori wajib dipilih." }).int(),
  unit: z.string().trim().min(1, { error: "Satuan wajib diisi." }).max(20, { error: "Satuan maksimal 20 karakter." }),
  salePrice: rupiah("Harga jual", 1),
  minStock: whole("Stok minimum", 0),
});
export type ProductInput = z.input<typeof ProductSchema>;

export const CreateProductSchema = ProductSchema.extend({
  initialStock: whole("Stok awal", 0),
  costPrice: rupiah("Harga modal", 0),
}).superRefine((v, ctx) => {
  if (v.initialStock > 0 && v.costPrice < 1) {
    ctx.addIssue({ code: "custom", path: ["costPrice"], message: "Harga modal wajib diisi kalau ada stok awal." });
  }
});
export type CreateProductInput = z.input<typeof CreateProductSchema>;

export const SupplierSchema = z.object({
  name: z.string().trim().min(1, { error: "Nama supplier wajib diisi." }).max(100, { error: "Nama supplier maksimal 100 karakter." }),
  phone: z.string().transform((v, ctx) => {
    if (v.trim() === "") return null;
    const p = normalizePhone(v);
    if (!p) ctx.issues.push({ code: "custom", message: "Nomor HP tidak valid.", input: v });
    return p ?? "";
  }),
});
export type SupplierInput = z.input<typeof SupplierSchema>;

const productId = z.number({ error: "Produk wajib dipilih." }).int();
const qty = z.number({ error: "Jumlah wajib diisi." }).int().min(1, { error: "Jumlah minimal 1." }).max(100000, { error: "Jumlah maksimal 100000." });
const money = (label: string) => rupiah(label, 1);
const itemsMin = { error: "Minimal satu barang." };

// Shared by sale and purchase: the total and payment rows must match the lines exactly.
function checkDocument(
  v: { items: { productId: number; qty: number; unitPrice: number }[]; total: number; payments: { amount: number }[] },
  ctx: z.RefinementCtx,
) {
  if (new Set(v.items.map((i) => i.productId)).size !== v.items.length) {
    ctx.addIssue({ code: "custom", path: ["items"], message: "Produk yang sama dipilih dua kali." });
  }
  if (v.total !== itemsTotal(v.items)) {
    ctx.addIssue({ code: "custom", path: ["total"], message: "Total tidak sesuai." });
  }
  if (!paymentsMatchPrice(v.payments, v.total)) {
    ctx.addIssue({ code: "custom", path: ["payments"], message: "Total pembayaran harus sama dengan total." });
  }
}

// Unrefined so wizards can .pick() per-step fields (Zod 4 forbids pick on refined schemas).
export const SaleFields = z.object({
  buyerName: optionalText(100, "Nama pembeli"),
  date: DateSchema,
  notes: optionalText(255, "Catatan"),
  items: z.array(z.object({ productId, qty, unitPrice: money("Harga") })).min(1, itemsMin),
  total: money("Total"),
  payments: PaymentsSchema,
});
export const SaleSchema = SaleFields.superRefine(checkDocument);
export type SaleInput = z.input<typeof SaleSchema>;

export const PurchaseFields = z.object({
  supplierId: z.number({ error: "Supplier wajib dipilih." }).int(),
  date: DateSchema,
  notes: optionalText(255, "Catatan"),
  items: z.array(z.object({ productId, qty, unitCost: money("Harga modal") })).min(1, itemsMin),
  total: money("Total"),
  payments: PaymentsSchema,
});
export const PurchaseSchema = PurchaseFields.superRefine((v, ctx) =>
  checkDocument({ ...v, items: v.items.map((i) => ({ ...i, unitPrice: i.unitCost })) }, ctx),
);
export type PurchaseInput = z.input<typeof PurchaseSchema>;
