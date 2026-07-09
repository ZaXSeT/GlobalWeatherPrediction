import { describe, it, expect } from "vitest";
import { GET } from "@/app/api/weather/route";

// Exercises the real route handler (validation + rate-limit path) without a network
// call - bad queries are rejected before the provider is ever contacted.
describe("GET /api/weather (integration)", () => {
  it("returns 400 when no city/coords are given (SR-1)", async () => {
    const res = await GET(new Request("http://localhost/api/weather"));
    expect(res.status).toBe(400);
  });

  it("returns 400 for an out-of-range latitude (SR-1)", async () => {
    const res = await GET(new Request("http://localhost/api/weather?lat=999&lon=0"));
    expect(res.status).toBe(400);
  });

  it("responds with a generic JSON error body (SR-15)", async () => {
    const res = await GET(new Request("http://localhost/api/weather"));
    const body = (await res.json()) as { error?: string };
    expect(typeof body.error).toBe("string");
  });
});
