import * as z from "zod";

export const ChangePasswordSchema = z
  .object({
    target: z.enum(["kasir", "self"], { error: "Akun tidak valid." }),
    currentPassword: z.string().min(1, { error: "Password saat ini wajib diisi." }),
    newPassword: z.string().min(8, { error: "Password minimal 8 karakter." }),
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    error: "Password tidak sama.",
    path: ["confirmPassword"],
  });
export type ChangePasswordInput = z.input<typeof ChangePasswordSchema>;
