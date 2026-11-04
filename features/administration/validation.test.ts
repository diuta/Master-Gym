import { describe, expect, it } from "vitest";
import { ChangePasswordSchema } from "./validation";

const valid = {
  target: "kasir",
  currentPassword: "lama12345",
  newPassword: "baru12345",
  confirmPassword: "baru12345",
};

const messages = (patch: object) =>
  ChangePasswordSchema.safeParse({ ...valid, ...patch }).error?.issues.map((i) => i.message);

describe("ChangePasswordSchema", () => {
  it.each(["kasir", "self"])("accepts target %s", (target) => {
    expect(ChangePasswordSchema.safeParse({ ...valid, target }).success).toBe(true);
  });
  it("rejects a short new password", () => {
    expect(messages({ newPassword: "pendek1", confirmPassword: "pendek1" })).toContain(
      "Password minimal 8 karakter.",
    );
  });
  it("rejects a mismatch on confirmPassword", () => {
    const r = ChangePasswordSchema.safeParse({ ...valid, confirmPassword: "lain12345" });
    expect(r.error?.issues).toEqual([
      expect.objectContaining({ path: ["confirmPassword"], message: "Password tidak sama." }),
    ]);
  });
  it("rejects an empty current password", () => {
    expect(messages({ currentPassword: "" })).toContain("Password saat ini wajib diisi.");
  });
  it("rejects an unknown target", () => {
    expect(ChangePasswordSchema.safeParse({ ...valid, target: "admin" }).success).toBe(false);
  });
});
