"use client";

import { Droplets, Sun, Thermometer, Wind } from "lucide-react";
import type { WeatherResult } from "@/lib/weather/types";
import { Card, CardContent } from "@/components/ui/card";

// All dynamic strings below are rendered as React text nodes, which React
// auto-escapes - that is our first-line XSS defense (SR-3). We deliberately do NOT
// use dangerouslySetInnerHTML anywhere, and the provider's `condition` text is shown
// as plain text, never as HTML.

const AQI_LABELS = [
  "Unknown",
  "Good",
  "Moderate",
  "Unhealthy (sensitive)",
  "Unhealthy",
  "Very unhealthy",
  "Hazardous",
];

/** Colour the AQI badge by severity so the number is not the only signal. */
const AQI_TONES = [
  "bg-muted text-muted-foreground",
  "bg-emerald-500/15 text-emerald-500",
  "bg-yellow-500/15 text-yellow-500",
  "bg-orange-500/15 text-orange-500",
  "bg-red-500/15 text-red-500",
  "bg-purple-500/15 text-purple-400",
  "bg-rose-700/20 text-rose-400",
];

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="p-5">
        <h3 className="mb-4 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          {title}
        </h3>
        {children}
      </CardContent>
    </Card>
  );
}

function Metric({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Thermometer;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
        <Icon aria-hidden className="size-4" />
      </span>
      <div className="min-w-0">
        <dt className="text-xs text-muted-foreground">{label}</dt>
        <dd className="truncate text-sm font-medium">{value}</dd>
      </div>
    </div>
  );
}

export function WeatherView({ data }: { data: WeatherResult }) {
  const { location, current, airQuality, hourly, daily } = data;

  return (
    <div className="flex flex-col gap-4">
      <Panel title="Current conditions">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <p className="font-heading truncate text-2xl font-semibold">
              {location.name}
              {location.region ? `, ${location.region}` : ""}
            </p>
            <p className="text-sm text-muted-foreground">{location.country}</p>
            <p className="mt-1 text-muted-foreground">{current.condition}</p>
          </div>
          <p className="font-heading text-5xl font-bold leading-none sm:text-6xl">
            {Math.round(current.tempC)}
            <span className="align-top text-2xl text-muted-foreground">°C</span>
          </p>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
          <Metric icon={Thermometer} label="Feels like" value={`${Math.round(current.feelsLikeC)}°C`} />
          <Metric icon={Droplets} label="Humidity" value={`${current.humidity}%`} />
          <Metric
            icon={Wind}
            label="Wind"
            value={`${Math.round(current.windKph)} kph ${current.windDir}`}
          />
          <Metric icon={Sun} label="UV index" value={String(current.uv)} />
        </dl>
      </Panel>

      {airQuality && (
        <Panel title="Air quality (US EPA)">
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full px-3 py-1 text-sm font-medium ${
                AQI_TONES[airQuality.usEpaIndex] ?? AQI_TONES[0]
              }`}
            >
              {AQI_LABELS[airQuality.usEpaIndex] ?? "Unknown"}
            </span>
            <span className="text-sm text-muted-foreground">index {airQuality.usEpaIndex}</span>
          </div>
          <p className="mt-3 text-sm text-muted-foreground">
            PM2.5 {airQuality.pm25.toFixed(1)} · PM10 {airQuality.pm10.toFixed(1)} · O₃{" "}
            {airQuality.o3.toFixed(1)} · NO₂ {airQuality.no2.toFixed(1)}
          </p>
        </Panel>
      )}

      {hourly.length > 0 && (
        <Panel title="Hourly">
          {/* Scrolls within itself so a 24-hour strip never widens the page. */}
          <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
            {hourly.map((h) => (
              <div
                key={h.time}
                className="flex min-w-18 shrink-0 flex-col items-center gap-1 rounded-lg bg-muted/60 px-3 py-2.5 text-center"
              >
                <span className="text-xs text-muted-foreground">{h.time.slice(11)}</span>
                <span className="font-medium">{Math.round(h.tempC)}°</span>
                <span className="text-xs text-sky-500">{h.chanceOfRain}%</span>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {daily.length > 0 && (
        <Panel title="7-day forecast">
          <ul className="flex flex-col divide-y divide-border">
            {daily.map((d) => (
              <li key={d.date} className="flex items-center gap-3 py-2.5 text-sm">
                <span className="w-24 shrink-0 text-muted-foreground">{d.date}</span>
                <span className="min-w-0 flex-1 truncate">{d.condition}</span>
                <span className="w-12 shrink-0 text-right text-xs text-sky-500">
                  {d.chanceOfRain}%
                </span>
                <span className="w-20 shrink-0 text-right font-medium">
                  {Math.round(d.maxTempC)}° / {Math.round(d.minTempC)}°
                </span>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
