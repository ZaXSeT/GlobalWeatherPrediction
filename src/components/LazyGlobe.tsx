"use client";

import dynamic from "next/dynamic";

// Lazy-load the Three.js globe with ssr:false so the ~heavy 3D bundle is fetched
// only in the browser, only for the landing hero, and never blocks first paint or
// the security-critical code (CLAUDE.md §2: "must not gate the security work").
const GlobeHero = dynamic(() => import("./GlobeHero"), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse rounded-full bg-sky-500/10" />,
});

export function LazyGlobe() {
  return <GlobeHero />;
}
