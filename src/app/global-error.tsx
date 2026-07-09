"use client";

// SECURITY - Root-level generic error boundary [SR-15]
// Catches errors thrown in the root layout itself. Same principle as error.tsx: show
// a generic message, never leak internal details to the client.
export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <h1 className="text-2xl font-bold">Something went wrong</h1>
        <p className="opacity-70">An unexpected error occurred.</p>
        <button
          onClick={reset}
          className="rounded-lg bg-sky-600 px-5 py-2 font-medium text-white hover:bg-sky-700"
        >
          Try again
        </button>
      </body>
    </html>
  );
}
