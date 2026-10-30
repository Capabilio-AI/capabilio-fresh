"use client";

/** Keeps the workspace shell and navigation when one org page throws, instead of falling back to the root error page. */
export default function OrgError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div role="alert" className="o-card mx-auto mt-10 flex max-w-md flex-col items-center gap-3 p-8 text-center">
      <h1 className="text-[18px] font-extrabold text-app-charcoal">This page could not load</h1>
      <p className="text-[13.5px] text-app-muted">Something went wrong while fetching your data. Nothing was changed.</p>
      {error.digest && <p className="font-mono text-[12px] text-app-muted">Reference: {error.digest}</p>}
      <button type="button" onClick={reset} className="o-btn mt-2">Try again</button>
    </div>
  );
}
