// SECURITY — Safe structured logging with redaction [SR-14]
// Risk: Logs are a classic secret-leak channel — accidentally logging a password,
//       session token, cookie, API key, or DB URL puts those secrets wherever logs
//       are stored/shipped.
// How:  All app logging goes through this helper, which emits a single-line JSON
//       object and runs every metadata object through redact(), replacing the values
//       of known-sensitive keys with "[REDACTED]". We never pass raw request bodies,
//       cookies, or `process.env` into it.
// Why:  Centralizing logging + redaction makes "never log secrets" enforceable and
//       auditable instead of relying on every call site to remember.

const SENSITIVE_KEYS = new Set([
  "password",
  "passwordhash",
  "token",
  "accesstoken",
  "refreshtoken",
  "authorization",
  "cookie",
  "secret",
  "jwt_secret",
  "apikey",
  "api_key",
  "weather_api_key",
  "database_url",
  "csrf",
]);

type Meta = Record<string, unknown>;

function redact(meta: Meta): Meta {
  const out: Meta = {};
  for (const [key, value] of Object.entries(meta)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      out[key] = "[REDACTED]";
    } else if (value && typeof value === "object" && !Array.isArray(value)) {
      out[key] = redact(value as Meta);
    } else {
      out[key] = value;
    }
  }
  return out;
}

type Level = "info" | "warn" | "error";

function emit(level: Level, event: string, meta?: Meta): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...(meta ? redact(meta) : {}),
  });
  (level === "error" ? console.error : console.log)(line);
}

export const logger = {
  info: (event: string, meta?: Meta) => emit("info", event, meta),
  warn: (event: string, meta?: Meta) => emit("warn", event, meta),
  error: (event: string, meta?: Meta) => emit("error", event, meta),
};
