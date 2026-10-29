import { describe, expect, it } from "vitest";
import { RegisterMemberSchema } from "./validation";
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
