import { describe, expect, it } from "vitest";
import { todayWib } from "@/features/membership/logic";
import { OpeningBalanceSchema } from "./validation";

const valid = { asOf: todayWib(), cash: 1_000_000, bank: 500_000 };

describe("OpeningBalanceSchema", () => {
  it("accepts today with zero balances", () => {
    expect(OpeningBalanceSchema.safeParse({ asOf: todayWib(), cash: 0, bank: 0 }).success).toBe(true);
  });
  it.each([
    ["negative cash", { cash: -1 }, "cash"],
    ["negative bank", { bank: -1 }, "bank"],
    ["fractional cash", { cash: 1.5 }, "cash"],
    ["malformed date", { asOf: "2026-13-45x" }, "asOf"],
    ["future date", { asOf: "2999-01-01" }, "asOf"],
  ])("rejects %s", (_n, patch, path) => {
    const r = OpeningBalanceSchema.safeParse({ ...valid, ...patch });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === path)).toBe(true);
  });
  it("rejects a missing field", () => {
    const r = OpeningBalanceSchema.safeParse({ ...valid, cash: undefined });
    expect(r.success).toBe(false);
    expect(r.error?.issues.some((i) => i.path[0] === "cash")).toBe(true);
  });
  it("uses the future-date message", () => {
    const r = OpeningBalanceSchema.safeParse({ ...valid, asOf: "2999-01-01" });
    expect(r.error?.issues[0].message).toBe("Tanggal tidak boleh di masa depan.");
  });
});
