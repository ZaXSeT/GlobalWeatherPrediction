import { describe, it, expect } from "vitest";
import { SignJWT } from "jose";
import { signSession, verifySession } from "@/lib/auth/jwt";

const secret = new TextEncoder().encode(process.env.JWT_SECRET);

describe("JWT sessions (SR-5)", () => {
  it("round-trips a valid token", async () => {
    const token = await signSession("user-123");
    expect(await verifySession(token)).toEqual({ userId: "user-123" });
  });

  it("rejects a tampered token", async () => {
    const token = await signSession("user-123");
    expect(await verifySession(token.slice(0, -2) + "xx")).toBeNull();
  });

  it("rejects garbage", async () => {
    expect(await verifySession("not.a.jwt")).toBeNull();
  });

  it("rejects an expired token", async () => {
    const expired = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u")
      .setExpirationTime(Math.floor(Date.now() / 1000) - 10)
      .sign(secret);
    expect(await verifySession(expired)).toBeNull();
  });

  it("rejects an alg:none token (algorithm-confusion)", async () => {
    const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
    const none = `${b64({ alg: "none", typ: "JWT" })}.${b64({ sub: "attacker", exp: 9999999999 })}.`;
    expect(await verifySession(none)).toBeNull();
  });

  it("rejects a token signed with a different secret", async () => {
    const otherSecret = new TextEncoder().encode("a-completely-different-32-char-secret-xx");
    const forged = await new SignJWT({})
      .setProtectedHeader({ alg: "HS256" })
      .setSubject("u")
      .setExpirationTime("1h")
      .sign(otherSecret);
    expect(await verifySession(forged)).toBeNull();
  });
});
