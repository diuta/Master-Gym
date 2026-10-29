import { describe, expect, it } from "vitest";
import { parsePeriod, periodRange } from "./period";

describe("periodRange", () => {
  const today = "2026-10-30"; // Friday
  it("today", () => expect(periodRange("today", today)).toEqual({ from: today, to: today }));
  it("week starts Monday", () => {
    expect(periodRange("week", today).from).toBe("2026-10-26");
    expect(periodRange("week", "2026-11-01").from).toBe("2026-10-26"); // Sunday
    expect(periodRange("week", "2026-10-26").from).toBe("2026-10-26"); // Monday
  });
  it("month and year", () => {
    expect(periodRange("month", today)).toEqual({ from: "2026-10-01", to: today });
    expect(periodRange("year", today)).toEqual({ from: "2026-01-01", to: today });
  });
  it("all is unbounded", () => expect(periodRange("all", today)).toEqual({}));
  it("custom drops malformed values", () => {
    expect(periodRange("custom", today, { from: "2026-10-01", to: "bad" })).toEqual({ from: "2026-10-01" });
    expect(periodRange("custom", today)).toEqual({});
  });
});

describe("parsePeriod", () => {
  it("falls back to month", () => {
    expect(parsePeriod("x")).toBe("month");
    expect(parsePeriod(undefined)).toBe("month");
    expect(parsePeriod("week")).toBe("week");
  });
});
