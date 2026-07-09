"use client";

// SECURITY - Generic client-facing error boundary [SR-15]
// Risk: An unhandled render error could otherwise surface internal details (stack
//       traces, component/file names) to the user.
// How:  This boundary catches errors in the route subtree and shows a fixed, generic
//       message. The real error is delivered to the server/telemetry by Next, not
//       rendered to the user. (Next also strips error details from production builds.)
// Why:  Users get a friendly message; attackers get no implementation detail.
export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="mx-auto flex max-w-md flex-1 flex-col items-center justify-center gap-4 px-6 py-16 text-center">
      <h1 className="text-2xl font-bold">Something went wrong</h1>
      <p className="opacity-70">An unexpected error occurred. Please try again.</p>
      <button
        onClick={reset}
        className="rounded-lg bg-sky-600 px-5 py-2 font-medium text-white hover:bg-sky-700"
      >
        Try again
      </button>
    </main>
  );
}
