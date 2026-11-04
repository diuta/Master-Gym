import "server-only";
import { and, asc, eq, isNull, ne, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { db } from "@/lib/db";
import {
  expenses,
  members,
  memberships,
  openingBalance,
  payments,
  ptPurchases,
  purchases,
  saleItems,
  sales,
  visits,
} from "@/lib/db/schema";
import { methodOf, saleCostShares } from "./logic";
import type { Kind, Movement, Opening, SaleLine } from "./logic";

// paid_at is a UTC wall-clock timestamp without zone; shift it to Jakarta before taking the date.
const paidDateWib = sql<string>`(${payments.paidAt} at time zone 'UTC' at time zone 'Asia/Jakarta')::date::text`;

// shortcut: aggregates in memory, fine for a few hundred thousand rows; move sums into SQL past that
export async function listMovements(): Promise<Movement[]> {
  const ptMembers = alias(members, "pt_members");

  const [payRows, saleCostRows, expenseRows] = await Promise.all([
    db
      .select({
        id: payments.id,
        saleId: payments.saleId,
        purchaseId: payments.purchaseId,
        membershipId: payments.membershipId,
        visitId: payments.visitId,
        ptPurchaseId: payments.ptPurchaseId,
        method: payments.method,
        amount: payments.amount,
        paidAt: payments.paidAt,
        date: sql<string>`coalesce(${sales.date}::text, ${purchases.date}::text, ${paidDateWib})`,
        saleInvoice: sales.invoiceNo,
        purchaseInvoice: purchases.invoiceNo,
        memberName: members.name,
        visitName: visits.name,
        ptMemberName: ptMembers.name,
      })
      .from(payments)
      .leftJoin(sales, eq(sales.id, payments.saleId))
      .leftJoin(purchases, eq(purchases.id, payments.purchaseId))
      .leftJoin(memberships, eq(memberships.id, payments.membershipId))
      .leftJoin(members, eq(members.id, memberships.memberId))
      .leftJoin(visits, eq(visits.id, payments.visitId))
      .leftJoin(ptPurchases, eq(ptPurchases.id, payments.ptPurchaseId))
      .leftJoin(ptMembers, eq(ptMembers.id, ptPurchases.memberId))
      .where(
        and(
          or(isNull(payments.saleId), eq(sales.status, "success")),
          or(isNull(payments.purchaseId), eq(purchases.status, "success")),
        ),
      )
      .orderBy(asc(payments.id)),
    db
      .select({
        saleId: saleItems.saleId,
        rawCost: sql<string>`sum(${saleItems.qty} * ${saleItems.unitCost})`,
      })
      .from(saleItems)
      .innerJoin(sales, eq(sales.id, saleItems.saleId))
      .where(ne(sales.status, "cancelled"))
      .groupBy(saleItems.saleId),
    db.select().from(expenses),
  ]);

  const rawCostBySale = new Map(saleCostRows.map((r) => [r.saleId, Number(r.rawCost)]));
  const salePayIdx = new Map<number, number[]>();

  const out: Movement[] = payRows.map((p, i) => {
    let kind: Kind;
    let docId: number;
    let label: string;
    if (p.saleId !== null) {
      kind = "sale";
      docId = p.saleId;
      label = p.saleInvoice ?? "";
      salePayIdx.set(docId, [...(salePayIdx.get(docId) ?? []), i]);
    } else if (p.purchaseId !== null) {
      kind = "purchase";
      docId = p.purchaseId;
      label = p.purchaseInvoice ?? "";
    } else if (p.membershipId !== null) {
      kind = "membership";
      docId = p.membershipId;
      label = p.memberName ?? "";
    } else if (p.visitId !== null) {
      kind = "visit";
      docId = p.visitId;
      label = p.visitName ?? "";
    } else {
      kind = "pt";
      docId = p.ptPurchaseId!;
      label = p.ptMemberName ?? "";
    }
    return {
      date: p.date,
      at: p.paidAt,
      direction: kind === "purchase" ? "out" : "in",
      kind,
      docId,
      label,
      method: methodOf(p.method),
      amount: Number(p.amount),
      cost: 0,
    };
  });

  // Rows are already in payment-id order, so each sale's shares line up with its payments.
  for (const [saleId, idxs] of salePayIdx) {
    const shares = saleCostShares(
      rawCostBySale.get(saleId) ?? 0,
      idxs.map((i) => out[i].amount),
    );
    idxs.forEach((i, n) => {
      out[i].cost = shares[n];
    });
  }

  for (const e of expenseRows) {
    out.push({
      date: e.date,
      at: e.createdAt,
      direction: "out",
      kind: "expense",
      docId: e.id,
      label: e.description,
      method: methodOf(e.method),
      amount: Number(e.amount),
      cost: 0,
    });
  }
  return out;
}

export async function listSaleLines(): Promise<SaleLine[]> {
  const rows = await db
    .select({
      saleId: saleItems.saleId,
      date: sales.date,
      productId: saleItems.productId,
      productName: saleItems.productName,
      qty: saleItems.qty,
      lineTotal: saleItems.lineTotal,
      unitCost: saleItems.unitCost,
    })
    .from(saleItems)
    .innerJoin(sales, eq(sales.id, saleItems.saleId))
    .where(ne(sales.status, "cancelled"))
    .orderBy(asc(saleItems.id));
  return rows.map((r) => ({
    saleId: r.saleId,
    date: r.date,
    productId: r.productId,
    productName: r.productName,
    qty: r.qty,
    lineTotal: Number(r.lineTotal),
    rawCost: r.qty * Number(r.unitCost),
  }));
}

export async function getOpeningBalance(): Promise<Opening> {
  const [row] = await db.select().from(openingBalance).limit(1);
  if (!row) return null;
  return { cash: Number(row.cash), bank: Number(row.bank), asOf: row.asOf };
}
