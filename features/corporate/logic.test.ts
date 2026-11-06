import { describe, expect, it } from "vitest";
import { pickCorporatePurchase } from "./logic";
import type { PurchaseState } from "./logic";

const p = (id: number, startDate: string, endDate: string, visitQuota: number, used: number): PurchaseState => ({
  id, startDate, endDate, visitQuota, used,
});
const TODAY = "2026-11-06";

describe("pickCorporatePurchase", () => {
  it("skips an exhausted purchase", () => {
    const a = p(1, "2026-11-01", "2026-11-30", 10, 10);
    const b = p(2, "2026-11-01", "2026-12-31", 5, 0);
    expect(pickCorporatePurchase([a, b], TODAY)).toBe(b);
  });
  it("prefers the soonest end date", () => {
    const b = p(2, "2026-11-01", "2026-12-31", 5, 0);
    const c = p(3, "2026-11-01", "2026-11-20", 5, 2);
    expect(pickCorporatePurchase([b, c], TODAY)).toBe(c);
  });
  it("breaks end-date ties by lowest id", () => {
    const x = p(7, "2026-11-01", "2026-11-30", 5, 0);
    const y = p(4, "2026-11-01", "2026-11-30", 5, 0);
    expect(pickCorporatePurchase([x, y], TODAY)).toBe(y);
  });
  it("ignores a purchase that has not started", () => {
    expect(pickCorporatePurchase([p(1, "2026-11-07", "2026-12-07", 5, 0)], TODAY)).toBeNull();
  });
  it("ignores an expired purchase", () => {
    expect(pickCorporatePurchase([p(1, "2026-10-05", "2026-11-05", 5, 0)], TODAY)).toBeNull();
  });
  it("accepts a purchase bought today", () => {
    const a = p(1, TODAY, "2026-12-06", 5, 0);
    expect(pickCorporatePurchase([a], TODAY)).toBe(a);
  });
  it("accepts a purchase ending today", () => {
    const a = p(1, "2026-10-06", "2026-11-06", 5, 4);
    expect(pickCorporatePurchase([a], TODAY)).toBe(a);
  });
});
