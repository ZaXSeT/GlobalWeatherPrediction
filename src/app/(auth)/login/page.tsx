"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiMutate } from "@/lib/client/api";
import { CloudSun, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await apiMutate<{ error?: string }>("/api/auth/login", "POST", { email, password });
    setLoading(false);
    if (res.ok) {
      router.push("/dashboard");
      router.refresh();
    } else {
      // Show the server's generic message (SR-15) - never distinguishes the cause.
      setError(res.data?.error ?? "Login failed.");
    }
  }

  return (
    <main className="flex min-h-screen w-full items-center justify-center p-6 bg-[#f5f5f7]">
      <Card className="w-full max-w-md rounded-[2rem] border-black/5 bg-white shadow-[0_8px_30px_rgb(0,0,0,0.04)] overflow-hidden">
        <CardHeader className="flex flex-col items-center gap-2 pb-2 pt-10">
          <Link href="/" className="flex items-center gap-2 mb-2 hover:opacity-80 transition-opacity">
            <CloudSun className="h-8 w-8 text-foreground" />
            <span className="font-semibold tracking-tight text-xl">GlobalWeather</span>
          </Link>
          <CardTitle className="text-2xl font-semibold tracking-tight">Log in</CardTitle>
          <CardDescription className="text-center text-muted-foreground">
            Welcome back to GlobalWeather
          </CardDescription>
        </CardHeader>
        <CardContent className="p-8 sm:p-10 pt-4">
          <form onSubmit={submit} className="flex flex-col gap-4">
            <div className="space-y-4">
              <Input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                autoComplete="email"
                className="h-12 rounded-xl bg-black/[0.03] border-transparent focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-black/20 focus-visible:border-black/20 transition-all text-base px-4"
              />
              <Input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                autoComplete="current-password"
                className="h-12 rounded-xl bg-black/[0.03] border-transparent focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-black/20 focus-visible:border-black/20 transition-all text-base px-4"
              />
            </div>
            {error && <p className="text-sm text-red-500 font-medium px-1">{error}</p>}
            <Button
              type="submit"
              disabled={loading}
              className="mt-2 h-12 w-full rounded-full bg-foreground text-background hover:bg-foreground/90 font-medium text-base shadow-sm transition-all"
            >
              {loading ? "Logging in..." : "Log in"}
              {!loading && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </form>
          <div className="mt-8 text-center text-sm text-muted-foreground">
            No account?{" "}
            <Link href="/register" className="font-medium text-foreground hover:underline transition-all">
              Sign up
            </Link>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
