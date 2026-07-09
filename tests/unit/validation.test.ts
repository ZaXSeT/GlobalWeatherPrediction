import { describe, it, expect } from "vitest";
import { registerSchema, loginSchema } from "@/lib/validation/auth";
import { weatherQuerySchema } from "@/lib/validation/weather";
import { favoriteSchema } from "@/lib/validation/favorites";

describe("auth validation (SR-1)", () => {
  it("accepts a valid registration", () => {
    expect(registerSchema.safeParse({ email: "a@b.com", password: "password123" }).success).toBe(
      true,
    );
  });
  it("rejects a malformed email", () => {
    expect(registerSchema.safeParse({ email: "nope", password: "password123" }).success).toBe(
      false,
    );
  });
  it("rejects a too-short password", () => {
    expect(registerSchema.safeParse({ email: "a@b.com", password: "short" }).success).toBe(false);
  });
  it("rejects an over-72-byte password (bcrypt limit)", () => {
    expect(registerSchema.safeParse({ email: "a@b.com", password: "x".repeat(73) }).success).toBe(
      false,
    );
  });
  it("login accepts any non-empty password (no policy leak)", () => {
    expect(loginSchema.safeParse({ email: "a@b.com", password: "x" }).success).toBe(true);
  });
});

describe("weather query validation (SR-1)", () => {
  it("accepts a city", () => {
    expect(weatherQuerySchema.safeParse({ city: "London" }).success).toBe(true);
  });
  it("accepts lat/lon (coerced from strings)", () => {
    expect(weatherQuerySchema.safeParse({ lat: "51.5", lon: "-0.1" }).success).toBe(true);
  });
  it("rejects neither city nor coords", () => {
    expect(weatherQuerySchema.safeParse({}).success).toBe(false);
  });
  it("rejects an out-of-range latitude", () => {
    expect(weatherQuerySchema.safeParse({ lat: "999", lon: "0" }).success).toBe(false);
  });
});

describe("favorite validation (SR-1)", () => {
  it("accepts a valid favorite", () => {
    expect(
      favoriteSchema.safeParse({ city: "London", latitude: 51.5, longitude: -0.1 }).success,
    ).toBe(true);
  });
  it("rejects out-of-range coordinates", () => {
    expect(favoriteSchema.safeParse({ city: "X", latitude: 200, longitude: 0 }).success).toBe(
      false,
    );
  });
});
