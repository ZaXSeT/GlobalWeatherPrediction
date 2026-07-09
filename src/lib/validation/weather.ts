import { z } from "zod";

// SECURITY - Input validation at the weather trust boundary [SR-1]
// Risk: Unvalidated query params flow into an outbound provider request and the
//       cache key. Malformed/oversized/out-of-range input wastes provider quota,
//       pollutes the cache, and is a general injection/abuse vector.
// How:  Zod parses the query into either a bounded city string OR a lat/lon pair in
//       valid geographic range; anything else is rejected with a generic 400 before
//       any provider call or cache write.
// Why:  Validating at the boundary keeps bad input from ever reaching the provider
//       or the cache, and is the precondition for the SR-7 proxy and SR-9 limiter.

export const weatherQuerySchema = z
  .object({
    city: z.string().trim().min(1).max(100).optional(),
    lat: z.coerce.number().min(-90).max(90).optional(),
    lon: z.coerce.number().min(-180).max(180).optional(),
  })
  .refine((d) => Boolean(d.city) || (d.lat !== undefined && d.lon !== undefined), {
    message: "Provide either 'city' or both 'lat' and 'lon'.",
  });

export type WeatherQuery = z.infer<typeof weatherQuerySchema>;
