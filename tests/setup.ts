// Test environment bootstrap. Runs before any test file, so the security modules
// that validate env at import (src/lib/env.ts) see valid values. These are dummy
// test values - never real secrets.
process.env.NODE_ENV = "test";
process.env.JWT_SECRET = "test-jwt-secret-at-least-32-characters-long";
process.env.DATABASE_URL = "postgresql://user:pass@localhost:5432/testdb";
process.env.DIRECT_URL = "postgresql://user:pass@localhost:5432/testdb";
process.env.WEATHER_API_KEY = "test-weather-api-key";
process.env.NEXT_PUBLIC_APP_URL = "http://localhost:3000";
// Upstash intentionally unset → the in-memory rate limiter is exercised.
