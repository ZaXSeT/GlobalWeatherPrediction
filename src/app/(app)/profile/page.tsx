"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { apiGet, apiMutate } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

interface Me {
  authenticated: boolean;
  user: { id: string; email: string; createdAt: string } | null;
}

export default function ProfilePage() {
  const router = useRouter();
  const [me, setMe] = useState<Me["user"]>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    void (async () => {
      const res = await apiGet<Me>("/api/auth/me");
      if (active) {
        setMe(res.data?.user ?? null);
        setLoading(false);
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  async function logout() {
    await apiMutate("/api/auth/logout", "POST");
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-5">
      <h1 className="font-heading text-2xl font-semibold tracking-tight">Profile</h1>

      {loading ? (
        <p className="text-muted-foreground">Loading…</p>
      ) : me ? (
        <Card>
          <CardContent className="flex flex-col gap-4 p-5">
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Email</p>
              <p className="truncate font-medium">{me.email}</p>
            </div>
            <div>
              <p className="text-xs uppercase tracking-wider text-muted-foreground">Member since</p>
              <p className="font-medium">{new Date(me.createdAt).toLocaleDateString()}</p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <p className="text-muted-foreground">Could not load your profile.</p>
      )}

      <Button onClick={logout} variant="outline" className="w-fit">
        <LogOut aria-hidden />
        Log out
      </Button>
    </div>
  );
}
