import { describe, expect, it } from "vitest";
import { ExpenseSchema } from "./validation";
import { todayWib } from "@/features/membership/logic";

const valid = { date: todayWib(), categoryId: 1, description: " Listrik ", amount: 500000, method: "transfer" };

describe("ExpenseSchema", () => {
  it("accepts a valid expense and trims", () => {
    const r = ExpenseSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data?.description).toBe("Listrik");
  });
  it.each([
    ["amount 0", { amount: 0 }, "amount"],
    ["amount over max", { amount: 1_000_000_001 }, "amount"],
    ["future date", { date: "2999-01-01" }, "date"],
    ["junk date", { date: "2026-13-45x" }, "date"],
    ["impossible date", { date: "2020-02-31" }, "date"],
    ["impossible month", { date: "2025-13-45" }, "date"],
    ["empty description", { description: " " }, "description"],
    ["bad method", { method: "credit" }, "method"],
  ])("rejects %s", (_n, patch, path) => {
    const r = ExpenseSchema.safeParse({ ...valid, ...patch });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === path)).toBe(true);
  });
});

it("gives impossible dates the invalid message, not the future one", () => {
  const r = ExpenseSchema.safeParse({ ...valid, date: "2025-13-45" });
  expect(r.error?.issues.map((i) => i.message)).toEqual(["Tanggal tidak valid."]);
});
