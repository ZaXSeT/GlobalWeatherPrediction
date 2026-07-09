"use client";

import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { apiGet } from "@/lib/client/api";
import { Card, CardContent } from "@/components/ui/card";

interface HistoryItem {
  id: string;
  city: string;
  latitude: number | null;
  longitude: number | null;
  createdAt: string;
}

export default function HistoryPage() {
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await apiGet<{ history: HistoryItem[] }>("/api/history");
      if (active) {
        setItems(res.data?.history ?? []);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Search history</h1>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 py-12 text-center">
            <Clock aria-hidden className="size-6 text-muted-foreground" />
            <p className="text-muted-foreground">No searches yet.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <ul className="flex flex-col divide-y divide-border">
              {items.map((h) => (
                <li key={h.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <span className="truncate font-medium">{h.city}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {new Date(h.createdAt).toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
