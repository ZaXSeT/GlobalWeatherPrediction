"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { apiMutate } from "@/lib/client/api";
import { LogoDropdown } from "@/components/weather/LogoDropdown";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/favorites", label: "Favorites" },
  { href: "/history", label: "History" },
  { href: "/profile", label: "Profile" },
];

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    // Logout is a mutation, so apiMutate attaches the CSRF token (SR-12).
    await apiMutate("/api/auth/logout", "POST");
    router.push("/login");
    router.refresh();
  }

  return (
    // On phones this wraps to two rows (brand + log out, then the links); from the `sm`
    // breakpoint up it collapses to a single row. The link strip scrolls within itself
    // instead of widening the page, which is what forced a sideways page scroll at 375px.
    <nav className="flex flex-wrap items-center gap-y-2 border-b border-border px-4 py-3">
      <div className="mr-4 sm:order-1 pt-1">
        <LogoDropdown />
      </div>

      <Button onClick={logout} variant="ghost" size="sm" className="ml-auto sm:order-3">
        <LogOut aria-hidden />
        Log out
      </Button>

      <div className="flex w-full items-center gap-1 overflow-x-auto sm:order-2 sm:w-auto sm:overflow-visible">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-md px-3 py-1.5 text-sm transition-colors hover:bg-muted",
              pathname === l.href ? "font-semibold text-primary" : "text-muted-foreground",
            )}
          >
            {l.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
