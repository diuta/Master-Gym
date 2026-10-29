import { describe, expect, it } from "vitest";
import { formatInvoiceNo, itemsTotal, movingAverage, reverseAverage, stockStatus } from "./logic";

describe("shop logic", () => {
  it("movingAverage", () => {
    expect(movingAverage(0, 0, 10, 5000)).toBe(5000);
    expect(movingAverage(10, 5000, 10, 7000)).toBe(6000);
    expect(movingAverage(0, 6000, 5, 8000)).toBe(8000);
  });
  it("reverseAverage", () => {
    expect(reverseAverage(20, 6000, 10, 7000)).toBe(5000);
    expect(reverseAverage(10, 7000, 10, 7000)).toBe(7000); // emptied: average kept
    expect(reverseAverage(10, 5000, 12, 7000)).toBe(5000);
    expect(reverseAverage(15, 5000, 10, 9000)).toBe(0); // clamps, never negative
  });
  it("stockStatus", () => {
    expect(stockStatus(0, 5)).toBe("out_of_stock");
    expect(stockStatus(5, 5)).toBe("low_stock");
    expect(stockStatus(6, 5)).toBe("in_stock");
  });
  it("itemsTotal", () => {
    expect(itemsTotal([{ qty: 2, unitPrice: 5000 }, { qty: 1, unitPrice: 3000 }])).toBe(13000);
  });
  it("formatInvoiceNo", () => {
    expect(formatInvoiceNo("PJ", 1)).toBe("PJ-0001");
    expect(formatInvoiceNo("PB", 12345)).toBe("PB-12345");
  });
});
