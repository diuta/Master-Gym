import { describe, expect, it } from "vitest";
import { CorporateCheckInSchema, CorporatePackageSchema, CorporatePurchaseSchema } from "./validation";

const pkg = { companyName: "PT Maju", employeeCount: 50, visitQuota: 100, months: 3, price: 1_000_000 };
const messages = (r: { success: boolean; error?: { issues: { message: string }[] } }) =>
  r.error?.issues.map((i) => i.message) ?? [];

describe("CorporatePackageSchema", () => {
  it("accepts a valid package", () => {
    expect(CorporatePackageSchema.safeParse(pkg).success).toBe(true);
  });
  it("requires 50 employees", () => {
    expect(messages(CorporatePackageSchema.safeParse({ ...pkg, employeeCount: 49 }))).toContain("Jumlah karyawan minimal 50.");
  });
  it("caps the quota", () => {
    expect(messages(CorporatePackageSchema.safeParse({ ...pkg, visitQuota: 100001 }))).toContain("Kuota visit maksimal 100.000.");
  });
  it("bounds months", () => {
    expect(messages(CorporatePackageSchema.safeParse({ ...pkg, months: 0 }))).toContain("Masa berlaku minimal 1 bulan.");
    expect(messages(CorporatePackageSchema.safeParse({ ...pkg, months: 61 }))).toContain("Masa berlaku maksimal 60 bulan.");
  });
});

describe("CorporatePurchaseSchema", () => {
  const base = { corporatePackageId: 1, visitQuota: 100, price: 1000, payments: [{ method: "cash", amount: 1000 }] };
  it("accepts matching payments", () => {
    expect(CorporatePurchaseSchema.safeParse(base).success).toBe(true);
  });
  it("rejects payments that differ from the price", () => {
    const r = CorporatePurchaseSchema.safeParse({ ...base, payments: [{ method: "cash", amount: 900 }] });
    expect(messages(r)).toContain("Total pembayaran harus sama dengan harga.");
  });
});

describe("CorporateCheckInSchema", () => {
  const base = { corporatePackageId: 1, employeeName: "Budi", phone: "", lockerNo: "" };
  it("rejects a bad phone", () => {
    expect(messages(CorporateCheckInSchema.safeParse({ ...base, phone: "123" }))).toContain("Nomor HP tidak valid.");
  });
  it("treats an empty phone as none", () => {
    const r = CorporateCheckInSchema.safeParse(base);
    expect(r.success && r.data.phone).toBeNull();
  });
  it("normalises a phone", () => {
    const r = CorporateCheckInSchema.safeParse({ ...base, phone: "+62 812-3456-7890" });
    expect(r.success && r.data.phone).toBe("081234567890");
  });
  it("requires a name", () => {
    expect(messages(CorporateCheckInSchema.safeParse({ ...base, employeeName: "" }))).toContain("Nama karyawan wajib diisi.");
  });
});
