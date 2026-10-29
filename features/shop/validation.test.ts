import { describe, expect, it } from "vitest";
import { CreateProductSchema, PurchaseFields, PurchaseSchema, SaleFields, SaleSchema, SupplierSchema } from "./validation";
import { todayWib } from "@/features/membership/logic";

const sale = {
  buyerName: " Budi ", date: todayWib(), notes: "",
  items: [{ productId: 1, qty: 2, unitPrice: 5000 }, { productId: 2, qty: 1, unitPrice: 3000 }],
  total: 13000,
  payments: [{ method: "cash", amount: 10000 }, { method: "qris", amount: 3000 }],
};
const purchase = {
  supplierId: 1, date: todayWib(), notes: "",
  items: [{ productId: 1, qty: 2, unitCost: 5000 }, { productId: 2, qty: 1, unitCost: 3000 }],
  total: 13000, payments: [{ method: "transfer", amount: 13000 }],
};

function tomorrow() {
  const d = new Date(`${todayWib()}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe.each([
  ["SaleSchema", SaleSchema, sale, "unitPrice"],
  ["PurchaseSchema", PurchaseSchema, purchase, "unitCost"],
] as const)("%s", (_n, schema, valid, priceKey) => {
  const item = (productId: number, qty: number, p: number) => ({ productId, qty, [priceKey]: p });
  const bad = (patch: object, path: string, message?: string) => {
    const r = schema.safeParse({ ...valid, ...patch });
    expect(r.success).toBe(false);
    const issue = r.error?.issues.find((i) => i.path[0] === path);
    expect(issue).toBeDefined();
    if (message) expect(issue?.message).toBe(message);
  };

  it("accepts a valid document", () => {
    const r = schema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data?.notes).toBeNull();
  });
  it("rejects empty items", () => bad({ items: [] }, "items", "Minimal satu barang."));
  it("rejects qty 0", () => bad({ items: [item(1, 0, 5000)], total: 0 }, "items"));
  it("rejects duplicate productId", () =>
    bad({ items: [item(1, 1, 5000), item(1, 1, 5000)], total: 10000, payments: [{ method: "cash", amount: 10000 }] },
      "items", "Produk yang sama dipilih dua kali."));
  it("rejects total mismatch", () => bad({ total: 12000 }, "total", "Total tidak sesuai."));
  it("rejects payments that differ from total", () =>
    bad({ payments: [{ method: "cash", amount: 5000 }] }, "payments", "Total pembayaran harus sama dengan total."));
  it("rejects a future date", () => bad({ date: tomorrow() }, "date", "Tanggal tidak boleh di masa depan."));
  it("rejects a malformed date", () => bad({ date: "2026-13-45x" }, "date", "Tanggal tidak valid."));
  it.each(["2020-02-31", "2025-13-45", "2026-00-10"])("rejects impossible date %s", (d) =>
    bad({ date: d }, "date", "Tanggal tidak valid."));
});

describe("CreateProductSchema", () => {
  const valid = { name: "Whey", categoryId: 1, unit: "pcs", salePrice: 10000, minStock: 2, initialStock: 0, costPrice: 0 };
  it("accepts no initial stock without a cost", () => {
    expect(CreateProductSchema.safeParse(valid).success).toBe(true);
  });
  it("requires cost when there is initial stock", () => {
    const r = CreateProductSchema.safeParse({ ...valid, initialStock: 3, costPrice: 0 });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(["costPrice"]);
  });
  it("caps prices at Rp1.000.000.000", () => {
    expect(CreateProductSchema.safeParse({ ...valid, salePrice: 1_000_000_000 }).success).toBe(true);
    const r = CreateProductSchema.safeParse({ ...valid, salePrice: 1_000_000_001 });
    expect(r.error?.issues[0].message).toBe("Harga jual maksimal Rp1.000.000.000.");
  });
  it("matches the DB name length: 100 ok, 101 rejected", () => {
    expect(CreateProductSchema.safeParse({ ...valid, name: "a".repeat(100) }).success).toBe(true);
    const r = CreateProductSchema.safeParse({ ...valid, name: "a".repeat(101) });
    expect(r.error?.issues[0].message).toBe("Nama produk maksimal 100 karakter.");
  });
});

describe("SupplierSchema", () => {
  it("maps empty phone to null and normalises others", () => {
    expect(SupplierSchema.parse({ name: "CV A", phone: "" }).phone).toBeNull();
    expect(SupplierSchema.parse({ name: "CV A", phone: "+62 812-3456-7890" }).phone).toBe("081234567890");
  });
  it("rejects a bad phone", () => {
    expect(SupplierSchema.safeParse({ name: "CV A", phone: "123" }).success).toBe(false);
  });
});

describe("wizard step picks", () => {
  it("SaleFields.pick parses a valid info step", () => {
    const r = SaleFields.pick({ date: true, buyerName: true, notes: true }).safeParse(sale);
    expect(r.success).toBe(true);
  });
  it("PurchaseFields.pick works too", () => {
    expect(PurchaseFields.pick({ date: true, notes: true }).safeParse(purchase).success).toBe(true);
  });
});
