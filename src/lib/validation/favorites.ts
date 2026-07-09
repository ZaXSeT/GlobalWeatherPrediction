import { z } from "zod";

// SECURITY - Input validation for user-data writes [SR-1]
// Risk: Unvalidated favorite/history payloads would write malformed/oversized data
//       to the database and pollute per-user records.
// How:  Zod validates a bounded city string and in-range coordinates before any DB
//       write; the userId is NEVER taken from the body (it comes from the session).
// Why:  Boundary validation keeps bad data out of the DB and, by omitting userId
//       from the accepted shape, structurally prevents a client from writing rows
//       "as" another user (reinforces SR-13).

export const favoriteSchema = z.object({
  city: z.string().trim().min(1).max(100),
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export const historySchema = z.object({
  city: z.string().trim().min(1).max(100),
  latitude: z.number().min(-90).max(90).optional(),
  longitude: z.number().min(-180).max(180).optional(),
});

export type FavoriteInput = z.infer<typeof favoriteSchema>;
export type HistoryInput = z.infer<typeof historySchema>;
