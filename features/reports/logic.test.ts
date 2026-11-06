import { describe, expect, it } from "vitest";
import {
  balances,
  byMethod,
  cashBankLabel,
  costOfGoods,
  expensesTotal,
  goodsProfit,
  inRange,
  methodOf,
  netProfit,
  omzet,
  omzetByKind,
  parseMethodFilter,
  productProfit,
  profitPercent,
  recentTransactions,
  saleCostShares,
  saleCount,
  salesDetail,
  splitWhole,
  transactionCount,
  type Movement,
  type SaleLine,
} from "./logic";

// Cancelled documents never reach these functions; listMovements filters them (Task 2).

let seq = 0;
function mv(p: Partial<Movement> & Pick<Movement, "direction" | "kind" | "method" | "amount">): Movement {
  seq += 1;
  return {
    date: "2026-11-09",
    at: new Date(Date.UTC(2026, 10, 9, 0, seq)),
    docId: seq,
    label: "x",
    cost: 0,
    ...p,
  };
}

const fixture = (): Movement[] => [
  mv({ direction: "in", kind: "sale", docId: 1, method: "cash", amount: 3333, cost: 1666 }),
  mv({ direction: "in", kind: "sale", docId: 1, method: "bank", amount: 6667, cost: 3335 }),
  mv({ direction: "in", kind: "membership", docId: 2, method: "cash", amount: 300000 }),
  mv({ direction: "out", kind: "expense", docId: 3, method: "bank", amount: 50000 }),
  mv({ direction: "out", kind: "purchase", docId: 4, method: "cash", amount: 20000 }),
];

describe("splitWhole", () => {
  it("gives the leftover to the largest weight", () => {
    expect(splitWhole(5001, [3333, 6667])).toEqual([1666, 3335]);
    expect(splitWhole(10, [1, 1, 1])).toEqual([4, 3, 3]);
    expect(splitWhole(7, [0, 0])).toEqual([7, 0]);
  });
  it("always sums to the total", () => {
    const parts = splitWhole(99999, [1, 2, 3, 4]);
    expect(parts.reduce((a, b) => a + b, 0)).toBe(99999);
  });
});

describe("saleCostShares", () => {
  it("rounds the cost then splits by payment", () => {
    expect(saleCostShares(5000.5, [3333, 6667])).toEqual([1666, 3335]);
  });
});

describe("cashBankLabel", () => {
  it("collapses methods to Cash / Bank", () => {
    expect(cashBankLabel(["cash"])).toBe("Cash");
    expect(cashBankLabel(["qris", "transfer"])).toBe("Bank");
    expect(cashBankLabel(["transfer", "cash"])).toBe("Cash + Bank");
    expect(cashBankLabel(["bank"])).toBe("Bank");
    expect(cashBankLabel([])).toBe("-");
  });
});

describe("method helpers", () => {
  it("methodOf / parseMethodFilter", () => {
    expect(methodOf("cash")).toBe("cash");
    expect(methodOf("qris")).toBe("bank");
    expect(methodOf("transfer")).toBe("bank");
    expect(parseMethodFilter("x")).toBe("all");
    expect(parseMethodFilter(undefined)).toBe("all");
    expect(parseMethodFilter("bank")).toBe("bank");
  });
});

describe("report numbers", () => {
  const rows = fixture();
  it("omzet", () => {
    expect(omzet(rows, "all")).toBe(310000);
    expect(omzet(rows, "cash")).toBe(303333);
    expect(omzet(rows, "bank")).toBe(6667);
    expect(omzetByKind(rows, "all")).toEqual({ sale: 10000, membership: 300000, visit: 0, pt: 0 });
  });
  it("cost, expenses and profit reconcile across methods", () => {
    expect(costOfGoods(rows, "all")).toBe(5001);
    expect(costOfGoods(rows, "cash") + costOfGoods(rows, "bank")).toBe(5001);
    expect(expensesTotal(rows, "all")).toBe(50000);
    expect(netProfit(rows, "all")).toBe(254999);
    expect(netProfit(rows, "cash") + netProfit(rows, "bank")).toBe(254999);
    expect(goodsProfit(rows, "all")).toBe(4999);
  });
  it("transactionCount counts documents, not payments", () => {
    expect(transactionCount(rows, "all")).toBe(2);
    expect(transactionCount(rows, "cash")).toBe(2);
    expect(transactionCount(rows, "bank")).toBe(1);
  });
  it("saleCount counts product sales only", () => {
    expect(saleCount(rows, "all")).toBe(1);
    expect(saleCount(rows, "cash")).toBe(1);
    expect(saleCount(rows, "bank")).toBe(1);
    const onlyMembership = [
      mv({ direction: "in", kind: "membership", method: "cash", amount: 300000 }),
    ];
    expect(saleCount(onlyMembership, "all")).toBe(0);
  });
  it("profitPercent", () => {
    expect(profitPercent([], "all")).toBeNull();
    const r = [
      mv({ direction: "in", kind: "membership", method: "cash", amount: 200000 }),
      mv({ direction: "out", kind: "expense", method: "cash", amount: 150000 }),
    ];
    expect(profitPercent(r, "all")).toBe(25);
    expect(profitPercent(rows, "all")).toBe(82.3);
  });
  it("byMethod filters", () => {
    expect(byMethod(rows, "all")).toHaveLength(5);
    expect(byMethod(rows, "bank")).toHaveLength(2);
  });
});

describe("balances", () => {
  const rows = [
    mv({ direction: "in", kind: "sale", method: "cash", amount: 10000, date: "2026-11-09" }),
    mv({ direction: "out", kind: "expense", method: "bank", amount: 50000, date: "2026-11-10" }),
  ];
  it("ignores rows before the opening date", () => {
    const o = { cash: 1000000, bank: 500000, asOf: "2026-11-10" };
    expect(balances(o, rows)).toEqual({ cash: 1000000, bank: 450000 });
  });
  it("counts everything without an opening", () => {
    expect(balances(null, rows)).toEqual({ cash: 10000, bank: -50000 });
  });
});

describe("inRange", () => {
  const rows = ["2026-11-01", "2026-11-05", "2026-11-09"].map((date) =>
    mv({ direction: "in", kind: "visit", method: "cash", amount: 1, date }),
  );
  it("is inclusive on both ends", () => {
    expect(inRange(rows, { from: "2026-11-01", to: "2026-11-05" })).toHaveLength(2);
    expect(inRange(rows, { from: "2026-11-05" })).toHaveLength(2);
    expect(inRange(rows, {})).toHaveLength(3);
  });
  it("filters any rows that carry a date", () => {
    const lines = [{ date: "2026-11-01" }, { date: "2026-11-09" }];
    expect(inRange(lines, { from: "2026-11-02" })).toEqual([{ date: "2026-11-09" }]);
  });
});

describe("salesDetail", () => {
  const rows = [
    ...fixture(),
    mv({ direction: "in", kind: "sale", docId: 9, method: "bank", amount: 500, date: "2026-11-10" }),
    mv({ direction: "in", kind: "sale", docId: 8, method: "cash", amount: 700, date: "2026-11-10" }),
  ];
  it.each(["all", "cash", "bank"] as const)("totals match omzet of sales for %s", (f) => {
    const total = salesDetail(rows, f).reduce((a, r) => a + r.total, 0);
    expect(total).toBe(omzetByKind(rows, f).sale);
  });
  it("groups by document, newest date first then docId desc", () => {
    expect(salesDetail(rows, "all").map((r) => [r.date, r.total])).toEqual([
      ["2026-11-10", 500],
      ["2026-11-10", 700],
      ["2026-11-09", 10000],
    ]);
  });
  it("ignores non-sale rows", () => {
    expect(salesDetail(fixture(), "cash")).toHaveLength(1);
  });
});

describe("recentTransactions", () => {
  it("groups payments, skips outflows, respects limit", () => {
    const recent = recentTransactions(fixture());
    expect(recent).toHaveLength(2);
    const sale = recent.find((r) => r.kind === "sale")!;
    expect(sale.methods).toEqual(["cash", "bank"]);
    expect(sale.total).toBe(10000);
    expect(recent.every((r) => r.kind === "sale" || r.kind === "membership")).toBe(true);
    expect(recent[0].at.getTime()).toBeGreaterThanOrEqual(recent[1].at.getTime());
    expect(recentTransactions(fixture(), 1)).toHaveLength(1);
  });
});

describe("productProfit", () => {
  const sales = fixture().filter((r) => r.kind === "sale");
  const lines: SaleLine[] = [
    { saleId: 1, date: "2026-11-09", productId: 10, productName: "A", qty: 3, lineTotal: 6000, rawCost: 3000.25 },
    { saleId: 1, date: "2026-11-09", productId: 11, productName: "B", qty: 2, lineTotal: 4000, rawCost: 2000.25 },
  ];
  const sum = (r: { omzet: number; cost: number }[], k: "omzet" | "cost") =>
    r.reduce((a, x) => a + x[k], 0);

  it("reconciles with the headline numbers", () => {
    const all = productProfit(lines, sales, "all");
    expect(sum(all, "omzet")).toBe(10000);
    expect(sum(all, "cost")).toBe(5001);
    const cash = productProfit(lines, sales, "cash");
    expect(sum(cash, "omzet")).toBe(3333);
    expect(sum(cash, "cost")).toBe(1666);
  });
  it("bank view sums to the bank payments", () => {
    const bank = productProfit(lines, sales, "bank");
    expect(sum(bank, "omzet")).toBe(6667);
    expect(sum(bank, "cost")).toBe(3335);
  });
  it("cash + bank equals all per product", () => {
    const all = productProfit(lines, sales, "all");
    const cash = productProfit(lines, sales, "cash");
    const bank = productProfit(lines, sales, "bank");
    for (const a of all) {
      const c = cash.find((r) => r.productId === a.productId)!;
      const b = bank.find((r) => r.productId === a.productId)!;
      expect(c.omzet + b.omzet).toBe(a.omzet);
      expect(c.cost + b.cost).toBe(a.cost);
    }
  });
  it("scales qty by the method share and sorts by profit", () => {
    const cash = productProfit(lines, sales, "cash");
    const a = cash.find((r) => r.productId === 10)!;
    expect(a.qty).toBeCloseTo((3 * 3333) / 10000, 10);
    const profits = cash.map((r) => r.profit);
    expect(profits).toEqual([...profits].sort((x, y) => y - x));
  });
});
