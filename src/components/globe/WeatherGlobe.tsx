"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import createGlobe, { type Globe } from "cobe";
import { Cloud, CloudRain, Sun } from "lucide-react";
import { apiGet } from "@/lib/client/api";
import type { WeatherResult } from "@/lib/weather/types";

interface City {
  id: string;
  label: string;
  lat: number;
  lon: number;
}

const CITIES: City[] = [
  { id: "jakarta", label: "Jakarta", lat: -6.21, lon: 106.85 },
  { id: "tokyo", label: "Tokyo", lat: 35.68, lon: 139.65 },
  { id: "london", label: "London", lat: 51.51, lon: -0.13 },
  { id: "new-york", label: "New York", lat: 40.71, lon: -74.01 },
  { id: "sydney", label: "Sydney", lat: -33.87, lon: 151.21 },
  { id: "sao-paulo", label: "Sao Paulo", lat: -23.55, lon: -46.63 },
];

const DEG = Math.PI / 180;
const AUTO_SPIN = 0.0016;
const MIN_THETA = -0.6;
const MAX_THETA = 0.6;

type CityWeather = { tempC: number; condition: string };
type Vec3 = readonly [number, number, number];

/** Latitude/longitude to the unit vector cobe uses for a marker. */
function toUnitVector(lat: number, lon: number): Vec3 {
  const polar = (90 - lat) * DEG;
  const azimuth = (lon + 180) * DEG;
  return [
    -Math.sin(polar) * Math.cos(azimuth),
    Math.cos(polar),
    Math.sin(polar) * Math.sin(azimuth),
  ];
}

/**
 * Mirrors cobe's own marker projection, taken from its source, so a popup lands exactly on
 * the dot cobe draws rather than drifting away from it. Returns fractions of the canvas.
 * `z >= 0` means the marker sits on the hemisphere facing the viewer.
 *
 * Deliberately NOT using CSS Anchor Positioning (which cobe also offers): that feature only
 * ships in Chromium, so the popups would be misplaced in Firefox and Safari.
 */
function project(v: Vec3, phi: number, theta: number) {
  const cosPhi = Math.cos(phi);
  const sinPhi = Math.sin(phi);
  const cosTheta = Math.cos(theta);
  const sinTheta = Math.sin(theta);

  const c = cosPhi * v[0] + sinPhi * v[2];
  const s = sinPhi * sinTheta * v[0] + cosTheta * v[1] - cosPhi * sinTheta * v[2];
  const z = -sinPhi * cosTheta * v[0] + sinTheta * v[1] + cosPhi * cosTheta * v[2];

  return { x: (c + 1) / 2, y: (-s + 1) / 2, z };
}

function conditionIcon(condition: string) {
  const text = condition.toLowerCase();
  if (text.includes("rain") || text.includes("drizzle") || text.includes("shower")) {
    return CloudRain;
  }
  if (text.includes("cloud") || text.includes("overcast") || text.includes("mist")) {
    return Cloud;
  }
  return Sun;
}

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export default function WeatherGlobe() {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const popupRefs = useRef<Record<string, HTMLDivElement | null>>({});

  const [weather, setWeather] = useState<Record<string, CityWeather>>({});

  const phi = useRef(0);
  const theta = useRef(0.25);
  const drag = useRef<{ x: number; y: number } | null>(null);

  const points = useMemo(
    () => CITIES.map((city) => ({ city, vector: toUnitVector(city.lat, city.lon) })),
    [],
  );

  // Weather for each pin comes from our own proxy, so the provider key stays server-side
  // (SR-7) and the request is rate limited per IP (SR-9). A failure just leaves a pin
  // showing its city name with no temperature, which is a fine degradation.
  useEffect(() => {
    let active = true;

    void (async () => {
      const results = await Promise.all(
        CITIES.map(async (city) => {
          const res = await apiGet<WeatherResult | { error: string }>(
            `/api/weather?lat=${city.lat}&lon=${city.lon}`,
          );
          if (!res.ok || !res.data || "error" in res.data) return null;
          const { tempC, condition } = res.data.current;
          return [city.id, { tempC, condition }] as const;
        }),
      );

      if (!active) return;
      setWeather(Object.fromEntries(results.filter((r) => r !== null)));
    })();

    return () => {
      active = false;
    };
  }, []);

  const onPointerDown = useCallback((e: React.PointerEvent) => {
    drag.current = { x: e.clientX, y: e.clientY };
    if (canvasRef.current) canvasRef.current.style.cursor = "grabbing";
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      const from = drag.current;
      if (!from) return;
      phi.current += (e.clientX - from.x) / 280;
      theta.current = clamp(theta.current + (e.clientY - from.y) / 460, MIN_THETA, MAX_THETA);
      drag.current = { x: e.clientX, y: e.clientY };
    };
    const onUp = () => {
      drag.current = null;
      if (canvasRef.current) canvasRef.current.style.cursor = "grab";
    };

    window.addEventListener("pointermove", onMove, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    let globe: Globe | null = null;
    let frame = 0;
    let built = 0;

    function build() {
      const size = container!.offsetWidth;
      if (!size || size === built) return;
      built = size;
      globe?.destroy();

      globe = createGlobe(canvas!, {
        devicePixelRatio: 2,
        width: size * 2,
        height: size * 2,
        phi: phi.current,
        theta: theta.current,
        dark: 0,
        diffuse: 1.2,
        mapSamples: 16000,
        mapBrightness: 7,
        baseColor: [1, 1, 1],
        markerColor: [0.055, 0.647, 0.914],
        glowColor: [0.87, 0.9, 0.94],
        markerElevation: 0,
        markers: CITIES.map((city) => ({
          location: [city.lat, city.lon] as [number, number],
          size: 0.05,
        })),
      });

      canvas!.style.opacity = "1";
    }

    function render() {
      if (!drag.current) phi.current += AUTO_SPIN;
      globe?.update({ phi: phi.current, theta: theta.current });

      for (const { city, vector } of points) {
        const el = popupRefs.current[city.id];
        if (!el) continue;
        const { x, y, z } = project(vector, phi.current, theta.current);
        el.style.left = `${x * 100}%`;
        el.style.top = `${y * 100}%`;
        // Fade a pin out as it swings around the limb rather than popping it off.
        el.style.opacity = z >= 0.06 ? "1" : "0";
      }

      frame = requestAnimationFrame(render);
    }

    build();
    render();

    const observer = new ResizeObserver(() => build());
    observer.observe(container);

    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      globe?.destroy();
    };
  }, [points]);

  return (
    <div ref={containerRef} className="relative aspect-square w-full select-none">
      <canvas
        ref={canvasRef}
        onPointerDown={onPointerDown}
        aria-label="Interactive globe. Drag to spin it."
        style={{
          width: "100%",
          height: "100%",
          opacity: 0,
          cursor: "grab",
          touchAction: "none",
          transition: "opacity 900ms ease",
          contain: "layout paint size",
        }}
      />

      {CITIES.map((city) => {
        const reading = weather[city.id];
        const Icon = reading ? conditionIcon(reading.condition) : Cloud;
        return (
          <div
            key={city.id}
            ref={(el) => {
              popupRefs.current[city.id] = el;
            }}
            style={{ opacity: 0 }}
            className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-[calc(100%+12px)] whitespace-nowrap rounded-lg border border-border bg-card/95 px-2.5 py-1.5 shadow-sm backdrop-blur-sm transition-opacity duration-300"
          >
            <div className="flex items-center gap-2">
              <Icon aria-hidden className="size-3.5 text-primary" />
              <span className="text-xs font-medium">{city.label}</span>
              {reading && (
                <span className="text-xs font-semibold tabular-nums">
                  {Math.round(reading.tempC)}°C
                </span>
              )}
            </div>
            {reading && (
              <p className="mt-0.5 text-[10px] leading-none text-muted-foreground">
                {reading.condition}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
