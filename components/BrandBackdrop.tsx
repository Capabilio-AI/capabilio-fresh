const BANNER_TILE_COUNT = 48;

/**
 * Shared authenticated-app background: the same lp-bg-grid pattern the
 * landing page uses, plus the "Capabilio AI" wordmark tiled as plain
 * repeated text (no per-tile logo icon — a denser, quieter watermark than
 * the earlier icon+text version) behind a floating card. Used by the
 * assessment flow and the dashboard so both feel like the same product as
 * the marketing site.
 */
export function BrandBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <main className="lp-bg-grid relative flex min-h-screen items-center justify-center overflow-hidden bg-lp-surface px-4 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 grid grid-cols-2 content-start gap-x-8 gap-y-14 p-10 opacity-[0.08] sm:grid-cols-3 md:grid-cols-4"
      >
        {Array.from({ length: BANNER_TILE_COUNT }).map((_, i) => (
          <span key={i} className="select-none whitespace-nowrap font-lp-display text-lp-body-lg font-semibold tracking-tight text-lp-text-ink">
            Capabilio <span className="text-lp-accent-ochre">AI</span>
          </span>
        ))}
      </div>
      <div className="relative z-10 flex w-full items-center justify-center">{children}</div>
    </main>
  );
}
