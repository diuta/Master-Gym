import * as z from "zod";
import { normalizePhone, paymentsMatchPrice, todayWib } from "./logic";
import type { MembershipStatus } from "./logic";

export type { MembershipStatus };
export type PaymentMethod = "cash" | "qris" | "transfer" | "debit";
export type MemberCategory = "pelajar" | "mahasiswa" | "umum";
export type Gender = "male" | "female";
export type MemberCard = {
  memberNo: string;
  name: string;
  phone: string;
  endDate: string;
  photoPath: string;
  qrToken: string;
};

export const CATEGORY_LABELS: Record<MemberCategory, string> = {
  pelajar: "Pelajar",
  mahasiswa: "Mahasiswa",
  umum: "Umum",
};
export const GENDER_LABELS: Record<Gender, string> = {
  male: "Laki-laki",
  female: "Perempuan",
};
export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: "Cash",
  qris: "QRIS",
  transfer: "Transfer",
  debit: "Debit",
};

const price = (label: string) =>
  z.number({ error: `${label} wajib diisi.` }).int().min(1, { error: `${label} minimal Rp1.` });

export const PackageSchema = z.object({
  name: z.string().trim().min(1, { error: "Nama paket wajib diisi." }).max(100, { error: "Nama paket maksimal 100 karakter." }),
  months: z.number({ error: "Durasi wajib diisi." }).int().min(1, { error: "Durasi minimal 1 bulan." }).max(60, { error: "Durasi maksimal 60 bulan." }),
});
export type PackageInput = z.input<typeof PackageSchema>;

export type CategoryPrices = Partial<Record<MemberCategory, number>>;
export const CategoryPricesSchema = z.object({
  pelajar: price("Harga pelajar"),
  mahasiswa: price("Harga mahasiswa"),
  umum: price("Harga umum"),
});
export type CategoryPricesInput = z.input<typeof CategoryPricesSchema>;

const name = z.string().trim().min(1, { error: "Nama wajib diisi." }).max(100, { error: "Nama maksimal 100 karakter." });
const phone = z
  .string()
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) ctx.issues.push({ code: "custom", message: "Nomor HP tidak valid.", input: v });
    return p ?? "";
  });
// "Today" is evaluated at parse time: the server process outlives a day.
const birthDate = z
  .string()
  .refine((v) => v === "" || /^\d{4}-\d{2}-\d{2}$/.test(v), { error: "Tanggal lahir tidak valid." })
  .refine((v) => v === "" || v <= todayWib(), { error: "Tanggal lahir tidak boleh di masa depan." })
  .transform((v) => (v === "" ? null : v));
const gender = z.enum(["male", "female"], { error: "Jenis kelamin wajib dipilih." });
const photo = z.string().startsWith("data:image/", { error: "Foto wajib diambil." });

const payments = z
  .array(
    z.object({
      method: z.enum(["cash", "qris", "transfer", "debit"], { error: "Metode pembayaran tidak valid." }),
      amount: z.number({ error: "Jumlah wajib diisi." }).int().min(1, { error: "Jumlah minimal Rp1." }),
    }),
  )
  .min(1, { error: "Minimal satu pembayaran." });
export const PaymentsSchema = payments;

// Shared by every schema that takes money: rows must add up to the price exactly.
function checkPayments(v: { payments: { amount: number }[]; price: number }, ctx: z.RefinementCtx) {
  if (!paymentsMatchPrice(v.payments, v.price)) {
    ctx.addIssue({ code: "custom", path: ["payments"], message: "Total pembayaran harus sama dengan harga." });
  }
}

export const RegisterMemberFields = z.object({
  name,
  phone,
  birthDate,
  gender,
  category: z.enum(["pelajar", "mahasiswa", "umum"], { error: "Kategori wajib dipilih." }),
  photo,
  packageId: z.number({ error: "Paket wajib dipilih." }).int(),
  startDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, { error: "Tanggal mulai tidak valid." })
    .refine((v) => v <= todayWib(), { error: "Tanggal mulai tidak boleh di masa depan." }),
  price: price("Harga"),
  payments,
});

export const RegisterMemberSchema = RegisterMemberFields.superRefine(checkPayments);
export type RegisterMemberInput = z.input<typeof RegisterMemberSchema>;

export const UpdateMemberSchema = z.object({
  id: z.number().int(),
  name,
  phone,
  birthDate,
  gender,
  photo: photo.optional(),
});
export type UpdateMemberInput = z.input<typeof UpdateMemberSchema>;

const memberId = z.number({ error: "Member wajib dipilih." }).int();
const lockerNo = z
  .string()
  .trim()
  .max(20, { error: "Nomor loker maksimal 20 karakter." })
  .transform((v) => (v === "" ? null : v));

export const CheckInSchema = z
  .object({
    memberId,
    lockerNo,
    useTrainer: z.boolean(),
    trainerId: z.number().int().optional(),
  })
  .superRefine((v, ctx) => {
    if (v.useTrainer && v.trainerId === undefined) {
      ctx.addIssue({ code: "custom", path: ["trainerId"], message: "Pilih trainer." });
    }
  });
export type CheckInInput = z.input<typeof CheckInSchema>;

export const VisitSchema = z
  .object({ name, phone, lockerNo, price: price("Harga"), payments })
  .superRefine(checkPayments);
export type VisitInput = z.input<typeof VisitSchema>;

export const RenewMemberSchema = z
  .object({
    memberId,
    category: z.enum(["pelajar", "mahasiswa", "umum"], { error: "Kategori wajib dipilih." }),
    packageId: z.number({ error: "Paket wajib dipilih." }).int(),
    price: price("Harga"),
    payments,
  })
  .superRefine(checkPayments);
export type RenewMemberInput = z.input<typeof RenewMemberSchema>;

export const PtPurchaseSchema = z
  .object({
    memberId,
    ptProgramId: z.number({ error: "Program PT wajib dipilih." }).int(),
    price: price("Harga"),
    payments,
  })
  .superRefine(checkPayments);
export type PtPurchaseInput = z.input<typeof PtPurchaseSchema>;

export const TrainerSchema = z.object({ name, phone });
export type TrainerInput = z.input<typeof TrainerSchema>;

export const PtProgramSchema = z.object({
  name: z.string().trim().min(1, { error: "Nama program wajib diisi." }).max(100, { error: "Nama program maksimal 100 karakter." }),
  sessions: z.number({ error: "Jumlah sesi wajib diisi." }).int().min(1, { error: "Minimal 1 sesi." }).max(200, { error: "Maksimal 200 sesi." }),
  price: price("Harga"),
});
export type PtProgramInput = z.input<typeof PtProgramSchema>;

export const VisitPriceSchema = z.object({ price: price("Harga") });
export type VisitPriceInput = z.input<typeof VisitPriceSchema>;

export type MemberSummary = {
  id: number;
  memberNo: string;
  name: string;
  phone: string;
  birthDate: string | null;
  gender: Gender;
  category: MemberCategory;
  photoPath: string;
  qrToken: string;
  packageName: string;
  endDate: string;
  status: MembershipStatus;
  daysRemaining: number;
  ptBalance: number;
  checkedInTodayAt: string | null; // "07.12"
};

export type AttendanceRow = {
  kind: "member" | "visitor";
  at: Date;
  name: string;
  memberNo: string | null;
  lockerNo: string | null;
  trainerName: string | null;
};

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success?: false; errors?: Record<string, string[]>; message?: string };
