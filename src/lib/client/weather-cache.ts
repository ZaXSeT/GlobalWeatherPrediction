"use client";

import { apiGet } from "@/lib/client/api";
import type { WeatherResult } from "@/lib/weather/types";

/**
 * Share one request per city across the whole page.
 *
 * Several components ask for the same places at once: the globe pins and the logo dropdown.
 * Without this, a single landing-page load fires around a dozen requests at /api/weather,
 * which the per-IP rate limiter (SR-9) will start rejecting with 429. Worse, React's
 * development double-mount doubles it. Here one in-flight promise per query is shared and a
 * successful result is reused for the life of the page. The server keeps its own short-TTL
 * cache too, so the provider is hit far less often than the UI asks.
 *
 * Failures are NOT cached: the entry is dropped so a later mount can try again (useful right
 * after fixing an invalid WEATHER_API_KEY without a hard reload).
 */
const inFlight = new Map<string, Promise<WeatherResult | null>>();

/** `query` is the raw query string, for example `city=London` or `lat=51.5&lon=-0.13`. */
export function fetchWeatherOnce(query: string): Promise<WeatherResult | null> {
  const key = query.toLowerCase();
  const existing = inFlight.get(key);
  if (existing) return existing;

  const request = (async (): Promise<WeatherResult | null> => {
    try {
      const res = await apiGet<WeatherResult | { error: string }>(`/api/weather?${query}`);
      if (!res.ok || !res.data || "error" in res.data) {
        inFlight.delete(key);
        return null;
      }
      return res.data;
    } catch {
      inFlight.delete(key);
      return null;
    }
  })();

  inFlight.set(key, request);
  return request;
}
