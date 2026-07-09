import { expect, type Page } from "@playwright/test";

/** A complete, provider-shaped WeatherResult used to stub /api/weather in e2e runs. */
export function fakeWeather() {
  const hourly = Array.from({ length: 24 }, (_, i) => ({
    time: `2026-01-03 ${String(i).padStart(2, "0")}:00`,
    tempC: 27 + (i % 5),
    condition: "Partly cloudy",
    iconCode: 1003,
    chanceOfRain: (i * 7) % 100,
    isDay: i > 6 && i < 18,
  }));
  const daily = Array.from({ length: 7 }, (_, i) => ({
    date: `2026-01-0${i + 3}`,
    maxTempC: 31 + i,
    minTempC: 24 + i,
    condition: "Patchy rain possible nearby",
    iconCode: 1063,
    chanceOfRain: 40 + i,
    sunrise: "05:45 AM",
    sunset: "06:10 PM",
  }));
  return {
    location: {
      name: "Jakarta",
      region: "Jakarta Raya",
      country: "Indonesia",
      lat: -6.21,
      lon: 106.85,
      localTime: "2026-01-03 12:00",
    },
    current: {
      tempC: 30.4,
      feelsLikeC: 35.1,
      condition: "Partly cloudy",
      iconCode: 1003,
      isDay: true,
      humidity: 74,
      windKph: 11.2,
      windDir: "WSW",
      uv: 7,
    },
    airQuality: { usEpaIndex: 2, pm25: 18.4, pm10: 24.9, o3: 61.3, no2: 12.7 },
    hourly,
    daily,
  };
}

/**
 * Fail if the page can be scrolled sideways, and name the elements sticking out past the
 * viewport so the failure points straight at the offending markup.
 */
export async function assertNoHorizontalOverflow(page: Page, viewportWidth: number, label: string) {
  const { scrollWidth, clientWidth } = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
  }));

  if (scrollWidth > clientWidth + 1) {
    const offenders = await page.evaluate((vw) => {
      const bad: string[] = [];
      for (const el of Array.from(document.querySelectorAll("*"))) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;
        if (r.right > vw + 1 || r.left < -1) {
          const cls = typeof el.className === "string" ? el.className : "";
          const short = cls.split(/\s+/).filter(Boolean).slice(0, 3).join(".");
          bad.push(
            `<${el.tagName.toLowerCase()}${short ? "." + short : ""}> right=${Math.round(r.right)}`,
          );
        }
      }
      return bad.slice(0, 10);
    }, viewportWidth);

    throw new Error(
      `Horizontal overflow on ${label} at ${viewportWidth}px: scrollWidth=${scrollWidth} > clientWidth=${clientWidth}.\n` +
        `Offending elements:\n  ${offenders.join("\n  ")}`,
    );
  }
  expect(scrollWidth).toBeLessThanOrEqual(clientWidth + 1);
}
