import "server-only";
import { and, asc, desc, eq, gte, lte } from "drizzle-orm";
import { db } from "@/lib/db";
import { expenseCategories, expenses } from "@/lib/db/schema";
import type { PaymentMethod } from "@/features/membership/validation";

export type ExpenseRow = {
  id: number;
  date: string;
  categoryName: string;
  description: string;
  amount: number;
  method: PaymentMethod;
};

export async function listActiveExpenseCategories(): Promise<{ id: number; name: string }[]> {
  return db
    .select({ id: expenseCategories.id, name: expenseCategories.name })
    .from(expenseCategories)
    .where(eq(expenseCategories.isActive, true))
    .orderBy(asc(expenseCategories.name));
}

export async function listExpenses(range: { from?: string; to?: string }): Promise<ExpenseRow[]> {
  const rows = await db
    .select()
    .from(expenses)
    .where(
      and(
        range.from ? gte(expenses.date, range.from) : undefined,
        range.to ? lte(expenses.date, range.to) : undefined,
      ),
    )
    .orderBy(desc(expenses.date), desc(expenses.id));
  return rows.map((r) => ({
    id: r.id,
    date: r.date,
    categoryName: r.categoryName,
    description: r.description,
    amount: Number(r.amount),
    method: r.method,
  }));
}
