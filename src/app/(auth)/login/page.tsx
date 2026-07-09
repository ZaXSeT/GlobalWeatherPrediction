"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiMutate } from "@/lib/client/api";

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
      // Show the server's generic message (SR-15) — never distinguishes the cause.
      setError(res.data?.error ?? "Login failed.");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-bold">Log in</h1>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          autoComplete="email"
          className="rounded-lg border border-black/15 bg-transparent px-4 py-2 outline-none focus:border-sky-500 dark:border-white/20"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
          autoComplete="current-password"
          className="rounded-lg border border-black/15 bg-transparent px-4 py-2 outline-none focus:border-sky-500 dark:border-white/20"
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {loading ? "…" : "Log in"}
        </button>
      </form>
      <p className="text-sm opacity-75">
        No account?{" "}
        <Link href="/register" className="text-sky-600 hover:underline dark:text-sky-400">
          Sign up
        </Link>
      </p>
    </main>
  );
}
