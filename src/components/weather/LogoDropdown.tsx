"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { CloudSun, ChevronDown, MapPin, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { apiGet } from "@/lib/client/api";
import type { WeatherResult } from "@/lib/weather/types";

const CITIES = ["New York", "London", "Tokyo", "Paris", "Sydney"];

export function LogoDropdown() {
  const [open, setOpen] = useState(false);
  const [weatherData, setWeatherData] = useState<Record<string, WeatherResult | null>>({});
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (open && Object.keys(weatherData).length === 0) {
      setLoading(true);
      Promise.all(
        CITIES.map((city) =>
          apiGet<WeatherResult>(`/api/weather?city=${encodeURIComponent(city)}`)
            .then((res) => ({ city, data: res.ok ? res.data : null }))
        )
      ).then((results) => {
        const newData: Record<string, WeatherResult | null> = {};
        results.forEach((r) => {
          newData[r.city] = r.data;
        });
        setWeatherData(newData);
        setLoading(false);
      });
    }
  }, [open, weatherData]);

  return (
    <div className="relative z-[99]" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex min-w-0 items-center gap-2 font-semibold transition-opacity hover:opacity-80 outline-none"
      >
        <CloudSun className="size-6 text-foreground" />
        <span className="hidden sm:inline tracking-tight text-xl">Global Weather</span>
        <ChevronDown className={`size-4 transition-transform duration-300 ${open ? "rotate-180" : ""}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.95 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="absolute left-0 top-full mt-4 w-[320px] rounded-[1.5rem] bg-white/90 backdrop-blur-2xl p-4 shadow-[0_8px_30px_rgb(0,0,0,0.12)] border border-black/5"
          >
            <div className="mb-3 px-2 flex justify-between items-center">
              <h3 className="text-sm font-semibold text-muted-foreground">Popular Cities</h3>
              <Link href="/" onClick={() => setOpen(false)} className="text-xs text-sky-600 font-medium hover:underline">
                Go to App
              </Link>
            </div>
            
            <div className="flex flex-col gap-1">
              {CITIES.map((city) => {
                const data = weatherData[city];
                return (
                  <div key={city} className="flex items-center justify-between rounded-2xl p-3 hover:bg-black/5 transition-colors cursor-default">
                    <div className="flex items-center gap-3">
                      <div className="flex size-10 items-center justify-center rounded-full bg-sky-50 text-sky-600">
                        {loading && !data ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
                      </div>
                      <div className="flex flex-col">
                        <span className="font-medium text-foreground">{city}</span>
                        <span className="text-xs text-muted-foreground">
                          {data ? data.current.condition : loading ? "Loading..." : "Unavailable"}
                        </span>
                      </div>
                    </div>
                    {data && (
                      <div className="text-2xl font-light tracking-tighter">
                        {Math.round(data.current.tempC)}°
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
