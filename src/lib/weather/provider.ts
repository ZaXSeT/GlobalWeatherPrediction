import { z } from "zod";
import { env } from "@/lib/env";
import type { WeatherResult } from "@/lib/weather/types";

// SECURITY - Weather API-key protection via server-side proxy [SR-7]
// Risk: If the browser called the weather provider directly, the API key would be
//       embedded in client code / network traffic, where anyone can extract it and
//       run up the owner's bill or quota.
// How:  This module runs ONLY on the server. It reads the key from
//       env.WEATHER_API_KEY (a non-NEXT_PUBLIC_ var, so Next.js never inlines it
//       into the client bundle) and attaches it to the outbound request here. The
//       browser only ever talks to our /api/weather route, never to the provider.
// Why:  The key is a bearer secret; keeping it server-side is the only way to stop
//       trivial theft and abuse. (Verified by grepping the client bundle for the
//       key - it must not appear.)

const PROVIDER_URL = "https://api.weatherapi.com/v1/forecast.json";
const REQUEST_TIMEOUT_MS = 8000;

/** Error type that never carries the request URL (which contains the API key). */
export class WeatherProviderError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
    this.name = "WeatherProviderError";
  }
}

// The provider is an untrusted external source (trust boundary TB-5): validate its
// response with Zod. Critical fields are required; the rest are optional/tolerant so
// a minor provider change degrades gracefully instead of crashing.
const conditionSchema = z.object({ text: z.string(), code: z.number() });

const providerSchema = z.object({
  location: z.object({
    name: z.string(),
    region: z.string().optional().default(""),
    country: z.string(),
    lat: z.number(),
    lon: z.number(),
    localtime: z.string(),
  }),
  current: z.object({
    temp_c: z.number(),
    feelslike_c: z.number(),
    is_day: z.number(),
    humidity: z.number(),
    wind_kph: z.number(),
    wind_dir: z.string(),
    uv: z.number(),
    condition: conditionSchema,
    air_quality: z
      .object({
        pm2_5: z.number().optional(),
        pm10: z.number().optional(),
        o3: z.number().optional(),
        no2: z.number().optional(),
        "us-epa-index": z.number().optional(),
      })
      .optional(),
  }),
  forecast: z.object({
    forecastday: z.array(
      z.object({
        date: z.string(),
        day: z.object({
          maxtemp_c: z.number(),
          mintemp_c: z.number(),
          daily_chance_of_rain: z.number().optional(),
          condition: conditionSchema,
        }),
        astro: z.object({ sunrise: z.string(), sunset: z.string() }).optional(),
        hour: z.array(
          z.object({
            time: z.string(),
            temp_c: z.number(),
            is_day: z.number(),
            chance_of_rain: z.number().optional(),
            condition: conditionSchema,
          }),
        ),
      }),
    ),
  }),
});

type ProviderResponse = z.infer<typeof providerSchema>;

function normalize(p: ProviderResponse): WeatherResult {
  const aq = p.current.air_quality;
  return {
    location: {
      name: p.location.name,
      region: p.location.region,
      country: p.location.country,
      lat: p.location.lat,
      lon: p.location.lon,
      localTime: p.location.localtime,
    },
    current: {
      tempC: p.current.temp_c,
      feelsLikeC: p.current.feelslike_c,
      condition: p.current.condition.text,
      iconCode: p.current.condition.code,
      isDay: p.current.is_day === 1,
      humidity: p.current.humidity,
      windKph: p.current.wind_kph,
      windDir: p.current.wind_dir,
      uv: p.current.uv,
    },
    airQuality: aq
      ? {
          usEpaIndex: aq["us-epa-index"] ?? 0,
          pm25: aq.pm2_5 ?? 0,
          pm10: aq.pm10 ?? 0,
          o3: aq.o3 ?? 0,
          no2: aq.no2 ?? 0,
        }
      : null,
    hourly: (p.forecast.forecastday[0]?.hour ?? []).map((h) => ({
      time: h.time,
      tempC: h.temp_c,
      condition: h.condition.text,
      iconCode: h.condition.code,
      chanceOfRain: h.chance_of_rain ?? 0,
      isDay: h.is_day === 1,
    })),
    daily: p.forecast.forecastday.map((d) => ({
      date: d.date,
      maxTempC: d.day.maxtemp_c,
      minTempC: d.day.mintemp_c,
      condition: d.day.condition.text,
      iconCode: d.day.condition.code,
      chanceOfRain: d.day.daily_chance_of_rain ?? 0,
      sunrise: d.astro?.sunrise ?? "",
      sunset: d.astro?.sunset ?? "",
    })),
  };
}

/**
 * Fetch + normalize weather for a query (`"London"` or `"48.8,2.3"`).
 * Runs server-side only. Throws WeatherProviderError on any failure.
 */
export async function fetchWeather(query: string): Promise<WeatherResult> {
  const url = new URL(PROVIDER_URL);
  url.searchParams.set("key", env.WEATHER_API_KEY); // SR-7: key attached server-side
  url.searchParams.set("q", query);
  url.searchParams.set("days", "7");
  url.searchParams.set("aqi", "yes");

  // Abort a hung upstream so a slow provider can't tie up our server indefinitely.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(url, { signal: controller.signal, headers: { accept: "application/json" } });
  } catch (cause) {
    // Note: we throw a message WITHOUT the URL - the URL contains the API key (SR-14).
    throw new WeatherProviderError(
      cause instanceof Error && cause.name === "AbortError"
        ? "Provider request timed out"
        : "Provider request failed",
    );
  } finally {
    clearTimeout(timer);
  }

  if (!res.ok) {
    throw new WeatherProviderError(`Provider responded ${res.status}`, res.status);
  }

  const json: unknown = await res.json();
  const parsed = providerSchema.safeParse(json);
  if (!parsed.success) {
    throw new WeatherProviderError("Unexpected provider response shape");
  }
  return normalize(parsed.data);
}
