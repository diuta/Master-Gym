import * as z from "zod";
import { DateSchema } from "@/features/shop/validation";

export const ExpenseCategorySchema = z.object({
  name: z.string().trim().min(1, { error: "Nama kategori wajib diisi." }).max(100, { error: "Nama kategori maksimal 100 karakter." }),
});
export type ExpenseCategoryInput = z.input<typeof ExpenseCategorySchema>;

export const ExpenseSchema = z.object({
  date: DateSchema,
  categoryId: z.number({ error: "Kategori wajib dipilih." }).int(),
  description: z.string().trim().min(1, { error: "Keterangan wajib diisi." }).max(200, { error: "Keterangan maksimal 200 karakter." }),
  amount: z.number({ error: "Jumlah wajib diisi." }).int().min(1, { error: "Jumlah minimal Rp1." }).max(1_000_000_000, { error: "Jumlah maksimal Rp1.000.000.000." }),
  method: z.enum(["cash", "qris", "transfer", "debit"], { error: "Metode pembayaran tidak valid." }),
});
export type ExpenseInput = z.input<typeof ExpenseSchema>;
