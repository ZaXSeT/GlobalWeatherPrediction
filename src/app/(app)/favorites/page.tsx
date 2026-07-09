"use client";

import { useEffect, useState } from "react";
import { MapPin, Trash2 } from "lucide-react";
import { apiGet, apiMutate } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Favorite {
  id: string;
  city: string;
  latitude: number;
  longitude: number;
  createdAt: string;
}

export default function FavoritesPage() {
  const [items, setItems] = useState<Favorite[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await apiGet<{ favorites: Favorite[] }>("/api/favorites");
      if (active) {
        setItems(res.data?.favorites ?? []);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function remove(id: string) {
    const res = await apiMutate(`/api/favorites/${id}`, "DELETE");
    if (res.ok) setItems((prev) => prev.filter((f) => f.id !== id));
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Favorites</h1>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <MapPin aria-hidden className="size-6 text-muted-foreground" />
            <p className="text-muted-foreground">No saved locations yet.</p>
          </CardContent>
        </Card>
      ) : (
        <ul className="flex flex-col gap-2">
          {items.map((f) => (
            <li key={f.id}>
              <Card>
                <CardContent className="flex items-center justify-between gap-3 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-medium">{f.city}</p>
                    <p className="text-xs text-muted-foreground">
                      {f.latitude.toFixed(2)}, {f.longitude.toFixed(2)}
                    </p>
                  </div>
                  <Button
                    onClick={() => remove(f.id)}
                    variant="destructive"
                    size="sm"
                    aria-label={`Remove ${f.city}`}
                  >
                    <Trash2 aria-hidden />
                    Remove
                  </Button>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
