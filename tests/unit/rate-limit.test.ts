import { describe, it, expect } from "vitest";
import { checkRateLimit } from "@/lib/rate-limit";

describe("rate limiting (SR-9, in-memory fallback)", () => {
  it("allows up to the limit, then blocks", async () => {
    const key = `test:rl:${Math.random()}`;
    const outcomes: boolean[] = [];
    for (let i = 0; i < 5; i++) {
      outcomes.push((await checkRateLimit(key, 3, 60)).success);
    }
    expect(outcomes).toEqual([true, true, true, false, false]);
  });

  it("tracks each key independently", async () => {
    const a = `test:a:${Math.random()}`;
    const b = `test:b:${Math.random()}`;
    await checkRateLimit(a, 1, 60); // consume a's only slot
    expect((await checkRateLimit(a, 1, 60)).success).toBe(false);
    expect((await checkRateLimit(b, 1, 60)).success).toBe(true);
  });
});
