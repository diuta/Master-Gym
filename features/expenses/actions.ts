"use server";

import { and, eq, ilike, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { expenseCategories, expenses } from "@/lib/db/schema";
import { requireRole } from "@/lib/auth/dal";
import { todayWib } from "@/features/membership/logic";
import type { ActionResult } from "@/features/membership/validation";
import {
  ExpenseCategorySchema,
  ExpenseSchema,
  type ExpenseCategoryInput,
  type ExpenseInput,
} from "./validation";

const OK = { success: true, data: undefined } as const;
const CATEGORY_NOT_FOUND = { message: "Kategori tidak ditemukan." };

const revalidate = () => revalidatePath("/expenses");

// Escape LIKE wildcards so ilike is an exact case-insensitive match.
const exactName = (name: string) => name.replace(/[\\%_]/g, "\\$&");

// Case-insensitive match; an active row wins if two differ only in case.
async function findCategoryByName(name: string, excludeId?: number) {
  const rows = await db
    .select({ id: expenseCategories.id, isActive: expenseCategories.isActive })
    .from(expenseCategories)
    .where(
      and(
        ilike(expenseCategories.name, exactName(name)),
        excludeId === undefined ? undefined : ne(expenseCategories.id, excludeId),
      ),
    );
  return rows.find((r) => r.isActive) ?? rows[0];
}

export async function createExpenseAction(input: ExpenseInput): Promise<ActionResult> {
  await requireRole("kasir");
  const v = ExpenseSchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };
  if (v.data.date > todayWib()) return { errors: { date: ["Tanggal tidak boleh di masa depan."] } };

  const [cat] = await db
    .select({ name: expenseCategories.name })
    .from(expenseCategories)
    .where(and(eq(expenseCategories.id, v.data.categoryId), eq(expenseCategories.isActive, true)))
    .limit(1);
  if (!cat) return { message: "Kategori tidak aktif." };

  await db.insert(expenses).values({
    date: v.data.date,
    categoryId: v.data.categoryId,
    categoryName: cat.name,
    description: v.data.description,
    amount: String(v.data.amount),
    method: v.data.method,
  });
  revalidate();
  return OK;
}

export async function deleteExpenseAction(id: number): Promise<ActionResult> {
  await requireRole("superadmin");
  const deleted = await db.delete(expenses).where(eq(expenses.id, id)).returning({ id: expenses.id });
  if (deleted.length === 0) return { message: "Pengeluaran tidak ditemukan." };
  revalidate();
  return OK;
}

export async function createExpenseCategoryAction(
  input: ExpenseCategoryInput,
): Promise<ActionResult> {
  await requireRole("superadmin");
  const v = ExpenseCategorySchema.safeParse(input);
  if (!v.success) return { errors: v.error.flatten().fieldErrors };

  const existing = await findCategoryByName(v.data.name);
  if (existing?.isActive) return { errors: { name: ["Kategori sudah ada."] } };
  if (existing) {
    // A "deleted" used category keeps its unique name; bring it back instead of colliding.
    await db
      .update(expenseCategories)
      .set({ name: v.data.name, isActive: true, updatedAt: new Date() })
      .where(eq(expenseCategories.id, existing.id));
  } else {
    await db.insert(expenseCategories).values({ name: v.data.name });
  }
  revalidate();
  return OK;
}

export async function updateExpenseCategoryAction(
  id: number,
  input: ExpenseCategoryInput,
): Promise<ActionResult> {
  await requireRole("superadmin");
  const v = ExpenseCategorySchema.safeParse(input);
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
    .update(expenseCategories)
    .set({ name: v.data.name, updatedAt: new Date() })
    .where(and(eq(expenseCategories.id, id), eq(expenseCategories.isActive, true)))
    .returning({ id: expenseCategories.id });
  if (updated.length === 0) return CATEGORY_NOT_FOUND;

  revalidate();
  return OK;
}

// Categories with expenses are only deactivated so history keeps its FK.
export async function deleteExpenseCategoryAction(id: number): Promise<ActionResult> {
  await requireRole("superadmin");

  const [used] = await db
    .select({ id: expenses.id })
    .from(expenses)
    .where(eq(expenses.categoryId, id))
    .limit(1);

  const result = used
    ? await db
        .update(expenseCategories)
        .set({ isActive: false, updatedAt: new Date() })
        .where(and(eq(expenseCategories.id, id), eq(expenseCategories.isActive, true)))
        .returning({ id: expenseCategories.id })
    : await db
        .delete(expenseCategories)
        .where(and(eq(expenseCategories.id, id), eq(expenseCategories.isActive, true)))
        .returning({ id: expenseCategories.id });
  if (result.length === 0) return CATEGORY_NOT_FOUND;

  revalidate();
  return OK;
}
