// Internal, provider-agnostic weather shape. The client depends ONLY on this -
// never on the raw provider payload - so we can swap providers and so untrusted
// provider fields never flow straight to the UI (supports SR-3).

export interface NormalizedLocation {
  name: string;
  region: string;
  country: string;
  lat: number;
  lon: number;
  localTime: string;
}

export interface CurrentConditions {
  tempC: number;
  feelsLikeC: number;
  condition: string; // human-readable text, e.g. "Partly cloudy"
  iconCode: number; // provider condition code; mapped to an icon client-side
  isDay: boolean;
  humidity: number;
  windKph: number;
  windDir: string;
  uv: number;
}

export interface AirQuality {
  usEpaIndex: number; // 1 (Good) … 6 (Hazardous)
  pm25: number;
  pm10: number;
  o3: number;
  no2: number;
}

export interface HourlyPoint {
  time: string;
  tempC: number;
  condition: string;
  iconCode: number;
  chanceOfRain: number;
  isDay: boolean;
}

export interface DailyForecast {
  date: string;
  maxTempC: number;
  minTempC: number;
  condition: string;
  iconCode: number;
  chanceOfRain: number;
  sunrise: string;
  sunset: string;
}

export interface WeatherResult {
  location: NormalizedLocation;
  current: CurrentConditions;
  airQuality: AirQuality | null;
  hourly: HourlyPoint[];
  daily: DailyForecast[];
}
