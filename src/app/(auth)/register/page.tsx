"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiMutate } from "@/lib/client/api";

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const res = await apiMutate<{ error?: string }>("/api/auth/register", "POST", {
      email,
      password,
    });
    setLoading(false);
    if (res.ok) {
      router.push("/login");
    } else {
      setError(res.data?.error ?? "Registration failed.");
    }
  }

  return (
    <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center gap-6 px-6 py-12">
      <h1 className="text-2xl font-bold">Create your account</h1>
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
          minLength={8}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password (min 8 characters)"
          autoComplete="new-password"
          className="rounded-lg border border-black/15 bg-transparent px-4 py-2 outline-none focus:border-sky-500 dark:border-white/20"
        />
        {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-sky-600 px-4 py-2 font-medium text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {loading ? "…" : "Sign up"}
        </button>
      </form>
      <p className="text-sm opacity-75">
        Already have an account?{" "}
        <Link href="/login" className="text-sky-600 hover:underline dark:text-sky-400">
          Log in
        </Link>
      </p>
    </main>
  );
}
