import * as z from "zod";
import { normalizePhone } from "../membership/logic";
import { PaymentsSchema, checkPayments, lockerNo, price } from "../membership/validation";

const visitQuota = z
  .number({ error: "Kuota visit wajib diisi." })
  .int()
  .min(1, { error: "Kuota visit minimal 1." })
  .max(100_000, { error: "Kuota visit maksimal 100.000." });

export const CorporatePackageSchema = z.object({
  companyName: z
    .string()
    .trim()
    .min(1, { error: "Nama perusahaan wajib diisi." })
    .max(100, { error: "Nama perusahaan maksimal 100 karakter." }),
  employeeCount: z
    .number({ error: "Jumlah karyawan wajib diisi." })
    .int()
    .min(50, { error: "Jumlah karyawan minimal 50." }),
  visitQuota,
  months: z
    .number({ error: "Masa berlaku wajib diisi." })
    .int()
    .min(1, { error: "Masa berlaku minimal 1 bulan." })
    .max(60, { error: "Masa berlaku maksimal 60 bulan." }),
  price: price("Harga"),
});
export type CorporatePackageInput = z.input<typeof CorporatePackageSchema>;

export const CorporatePurchaseSchema = z
  .object({
    corporatePackageId: z.number({ error: "Paket wajib dipilih." }).int(),
    visitQuota,
    price: price("Harga"),
    payments: PaymentsSchema,
  })
  .superRefine(checkPayments);
export type CorporatePurchaseInput = z.input<typeof CorporatePurchaseSchema>;

// Unlike the required member phone, an empty string here means "no phone".
const optionalPhone = z.string().transform((v, ctx) => {
  if (v.trim() === "") return null;
  const p = normalizePhone(v);
  if (!p) {
    ctx.issues.push({ code: "custom", message: "Nomor HP tidak valid.", input: v });
    return null;
  }
  return p;
});

export const CorporateCheckInSchema = z.object({
  corporatePackageId: z.number({ error: "Paket wajib dipilih." }).int(),
  employeeName: z
    .string()
    .trim()
    .min(1, { error: "Nama karyawan wajib diisi." })
    .max(100, { error: "Nama karyawan maksimal 100 karakter." }),
  phone: optionalPhone,
  lockerNo,
});
export type CorporateCheckInInput = z.input<typeof CorporateCheckInSchema>;
