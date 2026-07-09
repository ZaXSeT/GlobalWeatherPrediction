"use client";

import { useState } from "react";
import { Search, Star } from "lucide-react";
import { apiGet, apiMutate } from "@/lib/client/api";
import type { WeatherResult } from "@/lib/weather/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WeatherView } from "./WeatherView";

type WeatherOrError = WeatherResult | { error: string };

export function SearchDashboard() {
  const [city, setCity] = useState("");
  const [data, setData] = useState<WeatherResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [saveMsg, setSaveMsg] = useState<string | null>(null);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    if (!city.trim()) return;
    setLoading(true);
    setError(null);
    setData(null);
    setSaveMsg(null);

    // encodeURIComponent keeps the user's text from breaking the query string; the
    // server independently validates it (SR-1).
    const res = await apiGet<WeatherOrError>(`/api/weather?city=${encodeURIComponent(city.trim())}`);
    setLoading(false);

    if (!res.ok || !res.data || "error" in res.data) {
      setError((res.data as { error?: string } | null)?.error ?? "Could not fetch weather.");
      return;
    }
    const weather = res.data;
    setData(weather);
    // Record the search in the user's history (best-effort; ignore failures).
    void apiMutate("/api/history", "POST", {
      city: weather.location.name,
      latitude: weather.location.lat,
      longitude: weather.location.lon,
    });
  }

  async function saveFavorite() {
    if (!data) return;
    const res = await apiMutate<{ error?: string }>("/api/favorites", "POST", {
      city: data.location.name,
      latitude: data.location.lat,
      longitude: data.location.lon,
    });
    setSaveMsg(res.ok ? "Saved to favorites." : (res.data?.error ?? "Could not save."));
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Search a city…"
          aria-label="City"
        />
        <Button type="submit" disabled={loading}>
          <Search aria-hidden />
          {loading ? "Searching" : "Search"}
        </Button>
      </form>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {data && (
        <>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {saveMsg && <span className="text-xs text-muted-foreground">{saveMsg}</span>}
            <Button onClick={saveFavorite} variant="outline" size="sm">
              <Star aria-hidden />
              Save to favorites
            </Button>
          </div>
          <WeatherView data={data} />
        </>
      )}
    </div>
  );
}
