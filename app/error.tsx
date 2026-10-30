"use client";

import Link from "next/link";

/** Last-resort boundary for any route segment that throws while rendering. Shows no error details to the user. */
export default function RouteError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main role="alert" className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center px-4 text-center">
      <h1 className="text-[24px] font-extrabold tracking-tight text-app-charcoal">Something went wrong</h1>
      <p className="mt-2 text-[15px] text-app-muted">The page hit an unexpected problem. Try again, and if it keeps happening let us know.</p>
      {error.digest && <p className="mt-2 font-mono text-[12px] text-app-muted">Reference: {error.digest}</p>}
      <div className="mt-6 flex gap-3">
        <button type="button" onClick={reset} className="rounded-full bg-app-charcoal px-5 py-2.5 text-[14px] font-semibold text-white">
          Try again
        </button>
        <Link href="/" className="rounded-full border border-app-border px-5 py-2.5 text-[14px] font-semibold text-app-charcoal">
          Home
        </Link>
      </div>
    </main>
  );
}
