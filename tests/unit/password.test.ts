import { describe, it, expect } from "vitest";
import { hashPassword, verifyPasswordConstantTime } from "@/lib/auth/password";

describe("password hashing (SR-4)", () => {
  it("produces a bcrypt cost-12 hash", async () => {
    const hash = await hashPassword("correct horse battery staple");
    expect(hash.startsWith("$2b$12$")).toBe(true);
  });

  it("verifies a correct password", async () => {
    const hash = await hashPassword("s3cret-password");
    expect(await verifyPasswordConstantTime("s3cret-password", hash)).toBe(true);
  });

  it("rejects a wrong password", async () => {
    const hash = await hashPassword("s3cret-password");
    expect(await verifyPasswordConstantTime("wrong", hash)).toBe(false);
  });

  it("returns false when the user is absent (still runs a compare)", async () => {
    expect(await verifyPasswordConstantTime("anything", null)).toBe(false);
  });
});
