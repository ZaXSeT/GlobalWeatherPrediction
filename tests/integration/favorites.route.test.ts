import { describe, it, expect, vi } from "vitest";

// Mock next/headers so the session/CSRF cookie lookups see an EMPTY cookie jar -
// i.e. an unauthenticated request with no CSRF token. (Hoisted above the import.)
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: () => undefined,
    set: () => {},
  }),
}));

import { GET, POST } from "@/app/api/favorites/route";

describe("favorites route authorization (SR-13 / SR-12)", () => {
  it("returns 401 for an unauthenticated GET", async () => {
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 for a POST without a CSRF token", async () => {
    const res = await POST(
      new Request("http://localhost/api/favorites", {
        method: "POST",
        body: JSON.stringify({ city: "London", latitude: 51.5, longitude: -0.1 }),
        headers: { "content-type": "application/json" },
      }),
    );
    expect(res.status).toBe(403);
  });
});
