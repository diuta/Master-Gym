import * as z from "zod";

export const LoginSchema = z.object({
  email: z.string().trim().email({ error: "Email tidak valid." }),
  password: z.string().min(1, { error: "Password wajib diisi." }),
});

export type LoginState =
  | {
      errors?: {
        email?: string[];
        password?: string[];
      };
      message?: string;
    }
  | undefined;
