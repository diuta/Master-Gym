import { describe, expect, it } from "vitest";
import {
  CheckInSchema, PtProgramSchema, PtPurchaseSchema, RegisterMemberSchema, RenewMemberSchema,
  VisitSchema,
} from "./validation";
import { todayWib } from "./logic";

const valid = {
  name: " Budi ", phone: "+62 812 3456 7890", birthDate: "", gender: "male",
  category: "umum", photo: "data:image/jpeg;base64,AAAA", packageId: 1,
  startDate: todayWib(), price: 250000,
  payments: [{ method: "cash", amount: 100000 }, { method: "qris", amount: 150000 }],
};

describe("RegisterMemberSchema", () => {
  it("accepts a valid split payment and normalises fields", () => {
    const r = RegisterMemberSchema.safeParse(valid);
    expect(r.success).toBe(true);
    expect(r.data?.name).toBe("Budi");
    expect(r.data?.phone).toBe("081234567890");
    expect(r.data?.birthDate).toBeNull();
  });
  it.each([
    ["future start date", { startDate: "2999-01-01" }, "startDate"],
    ["future birth date", { birthDate: "2999-01-01" }, "birthDate"],
    ["bad phone", { phone: "123" }, "phone"],
    ["no photo", { photo: "" }, "photo"],
    ["payments short", { payments: [{ method: "cash", amount: 100000 }] }, "payments"],
    ["zero row", { payments: [{ method: "cash", amount: 250000 }, { method: "qris", amount: 0 }] }, "payments"],
    ["unknown method", { payments: [{ method: "credit", amount: 250000 }] }, "payments"],
  ])("rejects %s", (_label, patch, field) => {
    const r = RegisterMemberSchema.safeParse({ ...valid, ...patch });
    expect(r.success).toBe(false);
    expect(Object.keys(r.error!.flatten().fieldErrors)).toContain(field);
  });
});

const payments = [{ method: "cash", amount: 50000 }];
const errorFields = (r: { success: boolean; error?: { flatten(): { fieldErrors: object } } }) =>
  Object.keys(r.error!.flatten().fieldErrors);

describe("CheckInSchema", () => {
  const base = { memberId: 1, lockerNo: "", useTrainer: false };
  it("rejects useTrainer without trainerId", () => {
    const r = CheckInSchema.safeParse({ ...base, useTrainer: true });
    expect(r.success).toBe(false);
    expect(errorFields(r)).toContain("trainerId");
  });
  it("accepts no trainer", () => {
    expect(CheckInSchema.safeParse(base).success).toBe(true);
  });
  it("accepts a trainer", () => {
    expect(CheckInSchema.safeParse({ ...base, useTrainer: true, trainerId: 2 }).success).toBe(true);
  });
  it("turns a blank locker into null", () => {
    expect(CheckInSchema.parse({ ...base, lockerNo: "  " }).lockerNo).toBeNull();
  });
});

describe("VisitSchema", () => {
  const v = { name: "Ani", phone: "+62 812 3456 7890", lockerNo: "", price: 50000, payments };
  it("normalises the phone", () => {
    expect(VisitSchema.parse(v).phone).toBe("081234567890");
  });
  it("rejects payments short of price", () => {
    const r = VisitSchema.safeParse({ ...v, price: 60000 });
    expect(errorFields(r)).toContain("payments");
  });
  it("rejects an empty name", () => {
    expect(errorFields(VisitSchema.safeParse({ ...v, name: " " }))).toContain("name");
  });
});

describe("RenewMemberSchema", () => {
  const v = { memberId: 1, category: "umum", packageId: 1, price: 50000, payments };
  it("accepts valid input", () => {
    expect(RenewMemberSchema.safeParse(v).success).toBe(true);
  });
  it("rejects payments mismatch", () => {
    expect(errorFields(RenewMemberSchema.safeParse({ ...v, price: 1 }))).toContain("payments");
  });
  it("rejects missing packageId", () => {
    expect(errorFields(RenewMemberSchema.safeParse({ ...v, packageId: undefined }))).toContain("packageId");
  });
});

describe("PtPurchaseSchema", () => {
  const v = { memberId: 1, ptProgramId: 1, price: 50000, payments };
  it("accepts valid input", () => {
    expect(PtPurchaseSchema.safeParse(v).success).toBe(true);
  });
  it("rejects payments mismatch", () => {
    expect(errorFields(PtPurchaseSchema.safeParse({ ...v, price: 1 }))).toContain("payments");
  });
  it("rejects missing ptProgramId", () => {
    expect(errorFields(PtPurchaseSchema.safeParse({ ...v, ptProgramId: undefined }))).toContain("ptProgramId");
  });
});

describe("PtProgramSchema", () => {
  it("rejects 0 sessions", () => {
    expect(errorFields(PtProgramSchema.safeParse({ name: "PT 10", sessions: 0, price: 1000 }))).toContain("sessions");
  });
});
