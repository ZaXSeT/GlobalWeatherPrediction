// Node runtime: uses the server-side provider client (holds the API key) and Node APIs.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { weatherQuerySchema } from "@/lib/validation/weather";
import { fetchWeather } from "@/lib/weather/provider";
import { cacheGet, cacheSet } from "@/lib/weather/cache";
import type { WeatherResult } from "@/lib/weather/types";
import { checkRateLimit } from "@/lib/rate-limit";
import { getClientIp } from "@/lib/net";
import { jsonError, jsonOk } from "@/lib/http";
import { logger } from "@/lib/log";

// Weather is intentionally available to anonymous visitors (the landing-page demo
// search, PRD U10) but is rate-limited per IP to prevent quota-exhaustion abuse.
const RATE_LIMIT = 30;
const RATE_WINDOW_SECONDS = 60;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

export async function GET(req: Request) {
  // SR-9: rate limit FIRST, before validation or any provider call, so abusive
  // callers are cut off as cheaply as possible and can't burn our provider quota.
  const ip = getClientIp(req);
  const rl = await checkRateLimit(`weather:${ip}`, RATE_LIMIT, RATE_WINDOW_SECONDS);
  if (!rl.success) {
    const retryAfter = Math.max(1, Math.ceil((rl.reset - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many requests. Please slow down." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } },
    );
  }

  // SR-1: validate the query (bounded city OR in-range lat/lon).
  const { searchParams } = new URL(req.url);
  const parsed = weatherQuerySchema.safeParse(Object.fromEntries(searchParams));
  if (!parsed.success) {
    return jsonError("Provide a valid 'city' or 'lat' & 'lon'.", 400);
  }
  const query = parsed.data.city ? parsed.data.city : `${parsed.data.lat},${parsed.data.lon}`;
  const cacheKey = query.toLowerCase();

  // Serve from the short-TTL cache when possible (fewer provider calls).
  const cached = cacheGet<WeatherResult>(cacheKey);
  if (cached) {
    return jsonOk(cached, { headers: { "x-cache": "HIT" } });
  }

  try {
    // SR-7: the provider call (with the server-only key) happens here, never in the browser.
    const data = await fetchWeather(query);
    cacheSet(cacheKey, data, CACHE_TTL_MS);
    return jsonOk(data, { headers: { "x-cache": "MISS" } });
  } catch (err) {
    // SR-14 / SR-15: log the real detail server-side (never the URL, which holds the
    // key) and return a generic message - no provider internals leak to the client.
    logger.error("weather_fetch_failed", {
      message: err instanceof Error ? err.message : String(err),
    });
    return jsonError("Unable to fetch weather right now. Please try again.", 502);
  }
}
