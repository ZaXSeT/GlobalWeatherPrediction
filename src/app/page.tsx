import Link from "next/link";
import { CloudSun } from "lucide-react";
import { LazyGlobe } from "@/components/LazyGlobe";
import { DemoSearch } from "@/components/weather/DemoSearch";
import { Reveal } from "@/components/motion/Reveal";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";



export default function LandingPage() {
  return (
    <main className="relative flex w-full flex-1 flex-col overflow-x-clip bg-background">
      {/* Premium Apple-style Glass Navbar */}
      <header className="fixed inset-x-0 top-0 z-50 flex w-full border-b border-black/5 bg-white/70 backdrop-blur-md">
        <div className="flex w-full items-center justify-between px-6 py-4 md:px-12 lg:px-24">
          <Link href="/" className="flex min-w-0 items-center gap-2 font-semibold transition-opacity hover:opacity-80">
            <CloudSun className="size-6 text-foreground" />
            <span className="hidden sm:inline tracking-tight">Global Weather Prediction</span>
            <span className="sm:hidden tracking-tight">Global Weather</span>
          </Link>
          <nav className="flex shrink-0 items-center gap-2 text-sm">
            <Button asChild variant="ghost" size="sm" className="rounded-full">
              <Link href="/login">Log in</Link>
            </Button>
            <Button asChild size="sm" className="rounded-full">
              <Link href="/register">Sign up</Link>
            </Button>
          </nav>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex w-full flex-1 flex-col px-6 pt-24 md:px-12 lg:px-24">
        <section className="flex flex-col items-center text-center gap-10 pb-16 pt-12 md:pb-24 md:pt-20">
          <Reveal immediate className="flex flex-col items-center gap-8">


            <h1 className="max-w-5xl text-5xl font-semibold leading-tight tracking-tighter sm:text-7xl lg:text-8xl text-foreground">
              The weather for anywhere.
              <br className="hidden sm:block" />
              <span className="text-muted-foreground">Delivered securely.</span>
            </h1>

            <p className="max-w-2xl text-lg text-muted-foreground sm:text-xl">
              Current conditions, an hourly outlook, a 7-day forecast, and air quality, served by a
              backend that never exposes API keys or your data.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-4">
              <Button asChild size="lg" className="rounded-full px-8">
                <Link href="/register">Get started</Link>
              </Button>
              <Button asChild size="lg" variant="ghost" className="rounded-full px-8">
                <Link href="/login">Log in</Link>
              </Button>
            </div>
          </Reveal>

          {/* Decorative, lazy-loaded 3D globe. It never blocks first paint. */}
          <div className="mx-auto aspect-square w-full max-w-3xl">
            <LazyGlobe />
          </div>
        </section>

        {/* PRD U10: a visitor may try a search before registering. /api/weather needs no
            session, and the per-IP rate limit (SR-9) is what keeps this from being abused
            to exhaust the provider quota. */}
        <Reveal className="py-12 md:py-20">
          <div className="mx-auto w-full max-w-5xl">
            <Card className="rounded-[2rem] border-black/5 bg-white/50 backdrop-blur-xl shadow-[0_8px_30px_rgb(0,0,0,0.04)]">
              <CardContent className="flex flex-col gap-6 p-8 sm:p-12">
                <div className="flex flex-col gap-2 text-center">
                  <h2 className="text-3xl font-semibold tracking-tight text-foreground">Try it now</h2>
                  <p className="text-lg text-muted-foreground">Search any city. No account needed.</p>
                </div>
                <DemoSearch />
              </CardContent>
            </Card>
          </div>
        </Reveal>


      </div>

      <footer className="border-t border-border">
        <div className="flex w-full flex-col gap-4 px-6 py-8 text-sm text-muted-foreground sm:flex-row sm:items-center sm:justify-between md:px-12 lg:px-24">
          <span>Global Weather Prediction</span>
          <span>A university software security project.</span>
        </div>
      </footer>
    </main>
  );
}
