import { describe, expect, it } from "vitest";
import {
  daysRemaining, formatMemberNo, membershipEndDate, membershipStatus,
  membershipPrice, normalizePhone, paymentsMatchPrice, todayWib,
} from "./logic";

describe("todayWib", () => {
  it("uses Jakarta date, not UTC", () => {
    expect(todayWib(new Date("2026-10-28T16:59:00Z"))).toBe("2026-10-28");
    expect(todayWib(new Date("2026-10-28T17:00:00Z"))).toBe("2026-10-29");
  });
});

describe("membershipEndDate (inclusive last day, month-end clamp)", () => {
  it.each([
    ["2026-10-28", 1, "2026-11-27"],
    ["2026-01-31", 1, "2026-02-27"],
    ["2028-01-31", 1, "2028-02-28"], // leap year: clamp to 29 Feb, minus 1
    ["2026-12-15", 1, "2027-01-14"],
    ["2026-12-31", 12, "2027-12-30"],
    ["2026-03-01", 3, "2026-05-31"],
  ])("%s + %i months → %s", (start, months, end) => {
    expect(membershipEndDate(start, months)).toBe(end);
  });
});

describe("daysRemaining / membershipStatus", () => {
  const today = "2026-10-28";
  it.each([
    ["2026-11-05", 8, "active"],
    ["2026-11-04", 7, "expiring"],
    ["2026-10-28", 0, "expiring"],
    ["2026-10-27", -1, "expired"],
  ])("end %s → %i days, %s", (end, days, status) => {
    expect(daysRemaining(end, today)).toBe(days);
    expect(membershipStatus(end, today)).toBe(status);
  });
  it("counts across a DST-free month boundary exactly", () => {
    expect(daysRemaining("2027-03-01", "2027-02-01")).toBe(28);
  });
});

describe("normalizePhone", () => {
  it.each([
    ["0812-3456-7890", "081234567890"],
    ["+62 812 3456 7890", "081234567890"],
    ["6281234567890", "081234567890"],
    ["0812.3456.789", "08123456789"],
  ])("%s → %s", (input, out) => expect(normalizePhone(input)).toBe(out));
  it.each(["", "12345", "0812345", "081234567890123", "08123abc456", "812345678"])(
    "rejects %s",
    (input) => expect(normalizePhone(input)).toBeNull(),
  );
});

describe("membershipPrice", () => {
  it("multiplies the monthly base by months, null when unset", () => {
    expect(membershipPrice(200000, 3)).toBe(600000);
    expect(membershipPrice(undefined, 3)).toBeNull();
  });
});

describe("paymentsMatchPrice", () => {
  it("accepts rows summing exactly to the price", () => {
    expect(paymentsMatchPrice([{ amount: 100000 }, { amount: 150000 }], 250000)).toBe(true);
  });
  it.each([
    [[{ amount: 100000 }], 250000],               // short
    [[{ amount: 300000 }], 250000],               // over
    [[{ amount: 250000 }, { amount: 0 }], 250000], // zero row
    [[], 250000],                                  // no rows
    [[{ amount: 250000.5 }], 250000.5],            // not whole Rupiah
  ])("rejects %j for %i", (rows, price) => {
    expect(paymentsMatchPrice(rows, price)).toBe(false);
  });
});

describe("formatMemberNo", () => {
  it.each([[1, "MG-0001"], [42, "MG-0042"], [9999, "MG-9999"], [10000, "MG-10000"]])(
    "%i → %s",
    (n, out) => expect(formatMemberNo(n)).toBe(out),
  );
});
