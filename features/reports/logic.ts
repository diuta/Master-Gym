import type { PaymentMethod } from "@/features/membership/validation";

export type Method = "cash" | "bank";
export type MethodFilter = "all" | Method;
export type IncomeKind = "sale" | "membership" | "visit" | "pt" | "corporate";
export type Kind = IncomeKind | "purchase" | "expense";

export type Movement = {
  date: string; // YYYY-MM-DD, WIB
  at: Date;
  direction: "in" | "out";
  kind: Kind;
  docId: number;
  label: string; // invoice no. or name
  method: Method;
  amount: number;
  cost: number; // 0 unless kind = "sale"
};

export type Opening = { cash: number; bank: number; asOf: string } | null;

export function methodOf(m: PaymentMethod): Method {
  return m === "cash" ? "cash" : "bank";
}

// Histories show only Cash / Bank, so qris and transfer collapse into Bank.
export function cashBankLabel(methods: (PaymentMethod | Method)[]): string {
  const parts: string[] = [];
  if (methods.includes("cash")) parts.push("Cash");
  if (methods.some((m) => m !== "cash")) parts.push("Bank");
  return parts.length ? parts.join(" + ") : "-";
}

export function parseMethodFilter(v: string | undefined): MethodFilter {
  return v === "cash" || v === "bank" ? v : "all";
}

// Whole-rupiah split: floors every share, then gives the leftover to the largest weight so the
// parts always add back up to the total (otherwise per-method reports drift from the headline).
export function splitWhole(total: number, weights: number[]): number[] {
  const sum = weights.reduce((a, b) => a + b, 0);
  if (weights.length === 0) return [];
  if (sum === 0) return weights.map((_, i) => (i === 0 ? total : 0));
  const parts = weights.map((w) => Math.floor((total * w) / sum));
  const leftover = total - parts.reduce((a, b) => a + b, 0);
  let big = 0;
  weights.forEach((w, i) => {
    if (w > weights[big]) big = i;
  });
  parts[big] += leftover;
  return parts;
}

export function saleCostShares(cost: number, paymentAmounts: number[]): number[] {
  return splitWhole(Math.round(cost), paymentAmounts);
}

export function inRange<T extends { date: string }>(
  rows: T[],
  range: { from?: string; to?: string },
): T[] {
  return rows.filter(
    (r) => (!range.from || r.date >= range.from) && (!range.to || r.date <= range.to),
  );
}

export function byMethod(rows: Movement[], f: MethodFilter): Movement[] {
  return f === "all" ? rows : rows.filter((r) => r.method === f);
}

const sumAmount = (rows: Movement[]) => rows.reduce((a, r) => a + r.amount, 0);
const incomeRows = (rows: Movement[], f: MethodFilter) =>
  byMethod(rows, f).filter((r) => r.direction === "in");

export function omzet(rows: Movement[], f: MethodFilter): number {
  return sumAmount(incomeRows(rows, f));
}

export function omzetByKind(rows: Movement[], f: MethodFilter): Record<IncomeKind, number> {
  const out: Record<IncomeKind, number> = { sale: 0, membership: 0, visit: 0, pt: 0, corporate: 0 };
  for (const r of incomeRows(rows, f)) out[r.kind as IncomeKind] += r.amount;
  return out;
}

export function costOfGoods(rows: Movement[], f: MethodFilter): number {
  return incomeRows(rows, f).reduce((a, r) => a + r.cost, 0);
}

export function expensesTotal(rows: Movement[], f: MethodFilter): number {
  return sumAmount(byMethod(rows, f).filter((r) => r.kind === "expense"));
}

export function netProfit(rows: Movement[], f: MethodFilter): number {
  return omzet(rows, f) - costOfGoods(rows, f) - expensesTotal(rows, f);
}

export function goodsProfit(rows: Movement[], f: MethodFilter): number {
  return sumAmount(incomeRows(rows, f).filter((r) => r.kind === "sale")) - costOfGoods(rows, f);
}

export function profitPercent(rows: Movement[], f: MethodFilter): number | null {
  const o = omzet(rows, f);
  if (o === 0) return null;
  return Math.round((netProfit(rows, f) / o) * 1000) / 10;
}

export function transactionCount(rows: Movement[], f: MethodFilter): number {
  return new Set(incomeRows(rows, f).map((r) => `${r.kind}:${r.docId}`)).size;
}

// The Laporan tile is "Jumlah Transaksi Penjualan": product sales only, unlike transactionCount.
export function saleCount(rows: Movement[], f: MethodFilter): number {
  return new Set(byMethod(rows, f).filter((r) => r.kind === "sale").map((r) => r.docId)).size;
}

export function balances(opening: Opening, rows: Movement[]): { cash: number; bank: number } {
  const out = { cash: opening?.cash ?? 0, bank: opening?.bank ?? 0 };
  for (const r of rows) {
    if (opening && r.date < opening.asOf) continue;
    out[r.method] += r.direction === "in" ? r.amount : -r.amount;
  }
  return out;
}

export type RecentTx = {
  kind: IncomeKind;
  docId: number;
  at: Date;
  date: string;
  label: string;
  methods: Method[];
  total: number;
};

export function recentTransactions(rows: Movement[], limit = 10): RecentTx[] {
  const groups = new Map<string, RecentTx>();
  for (const r of rows) {
    if (r.direction !== "in") continue;
    const key = `${r.kind}:${r.docId}`;
    const g = groups.get(key);
    if (g) {
      g.total += r.amount;
      if (!g.methods.includes(r.method)) g.methods.push(r.method);
      if (r.at > g.at) g.at = r.at;
    } else {
      groups.set(key, {
        kind: r.kind as IncomeKind,
        docId: r.docId,
        at: r.at,
        date: r.date,
        label: r.label,
        methods: [r.method],
        total: r.amount,
      });
    }
  }
  const order: Method[] = ["cash", "bank"];
  return [...groups.values()]
    .map((g) => ({ ...g, methods: order.filter((m) => g.methods.includes(m)) }))
    .sort((a, b) => b.at.getTime() - a.at.getTime())
    .slice(0, limit);
}

export function salesDetail(
  rows: Movement[],
  f: MethodFilter,
): { date: string; label: string; total: number }[] {
  const byDoc = new Map<number, { docId: number; date: string; label: string; total: number }>();
  for (const r of byMethod(rows, f)) {
    if (r.kind !== "sale") continue;
    const cur = byDoc.get(r.docId) ?? { docId: r.docId, date: r.date, label: r.label, total: 0 };
    cur.total += r.amount;
    byDoc.set(r.docId, cur);
  }
  return [...byDoc.values()]
    .sort((a, b) => b.date.localeCompare(a.date) || b.docId - a.docId)
    .map(({ date, label, total }) => ({ date, label, total }));
}

export type SaleLine = {
  saleId: number;
  date: string;
  productId: number;
  productName: string;
  qty: number;
  lineTotal: number;
  rawCost: number; // qty x unit_cost, unrounded
};

export type ProductProfitRow = {
  productId: number;
  productName: string;
  qty: number;
  omzet: number;
  cost: number;
  profit: number;
};

export function productProfit(
  lines: SaleLine[],
  sales: Movement[],
  f: MethodFilter,
): ProductProfitRow[] {
  const bySale = new Map<number, SaleLine[]>();
  for (const l of lines) {
    const list = bySale.get(l.saleId);
    if (list) list.push(l);
    else bySale.set(l.saleId, [l]);
  }

  // Indexed once: filtering all sales per sale is quadratic.
  const byDoc = new Map<number, Movement[]>();
  for (const r of sales) {
    if (r.kind !== "sale") continue;
    const list = byDoc.get(r.docId);
    if (list) list.push(r);
    else byDoc.set(r.docId, [r]);
  }

  const acc = new Map<number, ProductProfitRow>();
  for (const [saleId, saleLines] of bySale) {
    const rows = byDoc.get(saleId) ?? [];
    const saleTotal = sumAmount(rows);
    const amtOf = (m?: Method) => sumAmount(m ? rows.filter((r) => r.method === m) : rows);
    const costOf = (m?: Method) =>
      (m ? rows.filter((r) => r.method === m) : rows).reduce((a, r) => a + r.cost, 0);
    const methodAmt = f === "all" ? saleTotal : amtOf(f);
    if (methodAmt === 0) continue;

    // Cash is split directly, bank is "all minus cash", so cash + bank equals the all-methods
    // figure for every product; a single bank line can differ by Rp1 from a direct split.
    const totals = saleLines.map((l) => l.lineTotal);
    const raws = saleLines.map((l) => l.rawCost);
    const cashOmzet = splitWhole(amtOf("cash"), totals);
    const cashCost = splitWhole(costOf("cash"), raws);
    const allCost = splitWhole(costOf(), raws);
    const allOmzet = splitWhole(saleTotal, totals);
    const lineOmzet = allOmzet.map((t, i) =>
      f === "all" ? t : f === "cash" ? cashOmzet[i] : t - cashOmzet[i],
    );
    const lineCost = allCost.map((c, i) =>
      f === "all" ? c : f === "cash" ? cashCost[i] : c - cashCost[i],
    );
    saleLines.forEach((l, i) => {
      const row = acc.get(l.productId) ?? {
        productId: l.productId,
        productName: l.productName,
        qty: 0,
        omzet: 0,
        cost: 0,
        profit: 0,
      };
      row.qty += (l.qty * methodAmt) / saleTotal;
      row.omzet += lineOmzet[i];
      row.cost += lineCost[i];
      row.profit = row.omzet - row.cost;
      acc.set(l.productId, row);
    });
  }
  return [...acc.values()].sort((a, b) => b.profit - a.profit);
}
