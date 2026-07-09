import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/auth/current-user";
import { AppNav } from "@/components/AppNav";

// SECURITY - Server-side auth guard for protected pages [SR-13 / auth]
// Risk: The dashboard, favorites, history, and profile pages are only for the
//       account owner; without a gate, an unauthenticated visitor could load them.
// How:  This server layout resolves the identity from the verified session cookie
//       (getCurrentUserId → verifies the JWT signature/expiry) BEFORE rendering, and
//       redirects to /login when there is no valid session. Runs on the server, so
//       the check can't be skipped by the client.
// Why:  A page-level gate is the authoritative access control for the authenticated
//       UI; the API routes independently re-check on every request (defense in depth).
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const userId = await getCurrentUserId();
  if (!userId) redirect("/login");

  return (
    <div className="flex min-h-full flex-col">
      <AppNav />
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
