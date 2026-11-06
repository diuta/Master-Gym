import * as z from "zod";
import { DateSchema } from "@/features/shop/validation";

const balance = (label: string) =>
  z
    .number({ error: `${label} wajib diisi.` })
    .int({ error: `${label} harus bilangan bulat.` })
    .min(0, { error: `${label} tidak boleh negatif.` })
    .max(999_999_999_999, { error: `${label} terlalu besar.` });

export const OpeningBalanceSchema = z.object({
  asOf: DateSchema,
  cash: balance("Saldo tunai"),
  bank: balance("Saldo bank"),
});
export type OpeningBalanceInput = z.input<typeof OpeningBalanceSchema>;
