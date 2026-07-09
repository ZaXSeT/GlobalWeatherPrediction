"use client";

import { useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import { apiGet } from "@/lib/client/api";
import type { WeatherResult } from "@/lib/weather/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { WeatherView } from "./WeatherView";

type WeatherOrError = WeatherResult | { error: string };

/**
 * The landing-page demo search (PRD U10). Deliberately available to anonymous visitors:
 * /api/weather requires no session, but it is throttled per IP (SR-9) so this cannot be
 * used to burn the provider quota. Unlike the authenticated dashboard, this records no
 * search history and offers no favorite button, since both require a session.
 */
export function DemoSearch() {
  const [city, setCity] = useState("");
  const [data, setData] = useState<WeatherResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function search(e: React.FormEvent) {
    e.preventDefault();
    const query = city.trim();
    if (!query) return;

    setLoading(true);
    setError(null);
    setData(null);

    // encodeURIComponent stops the user's text from breaking out of the query string;
    // the server validates it independently before any provider call (SR-1).
    const res = await apiGet<WeatherOrError>(`/api/weather?city=${encodeURIComponent(query)}`);
    setLoading(false);

    if (!res.ok || !res.data || "error" in res.data) {
      // Show the server's generic message (SR-15); it never reveals provider internals.
      setError((res.data as { error?: string } | null)?.error ?? "Could not fetch weather.");
      return;
    }
    setData(res.data);
  }

  return (
    <div className="flex flex-col gap-4">
      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
        <Input
          type="text"
          value={city}
          onChange={(e) => setCity(e.target.value)}
          placeholder="Try a city, for example Jakarta"
          aria-label="City"
          className="h-12"
        />
        <Button type="submit" size="lg" disabled={loading}>
          <Search aria-hidden />
          {loading ? "Searching" : "Search"}
        </Button>
      </form>

      {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}

      {data && (
        <>
          <WeatherView data={data} />
          <p className="text-sm text-muted-foreground">
            <Link href="/register" className="text-primary hover:underline">
              Create an account
            </Link>{" "}
            to save favorites and keep your search history.
          </p>
        </>
      )}
    </div>
  );
}
