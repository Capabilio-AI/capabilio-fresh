"use client";

/** Fires only when the root layout itself fails, so it must bring its own <html> and cannot rely on global CSS or components. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <html lang="en">
      <body style={{ fontFamily: "system-ui, sans-serif", margin: 0, minHeight: "100vh", display: "grid", placeItems: "center", textAlign: "center", padding: 16 }}>
        <div role="alert">
          <h1 style={{ fontSize: 24, margin: 0 }}>Something went wrong</h1>
          <p style={{ color: "#6b7280" }}>Please try again in a moment.</p>
          <button type="button" onClick={reset} style={{ marginTop: 16, padding: "10px 20px", borderRadius: 999, border: 0, background: "#171717", color: "#fff", fontWeight: 600, cursor: "pointer" }}>
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
