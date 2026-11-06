"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { openingBalance } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/dal";
import type { ActionResult } from "@/features/membership/validation";
import { OpeningBalanceSchema, type OpeningBalanceInput } from "./validation";

export async function saveOpeningBalanceAction(input: OpeningBalanceInput): Promise<ActionResult> {
  await requireRole("superadmin");
  const v = OpeningBalanceSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };

  // One-time by design: the single-row primary key makes a second save a no-op.
  const inserted = await db
    .insert(openingBalance)
    .values({ id: 1, cash: String(v.data.cash), bank: String(v.data.bank), asOf: v.data.asOf })
    .onConflictDoNothing()
    .returning({ id: openingBalance.id });
  if (inserted.length === 0) return { message: "Saldo awal sudah diisi." };

  revalidatePath("/dashboard");
  return { success: true, data: undefined };
}
