const BANNER_TILE_COUNT = 48;

/**
 * Shared authenticated-app background: the same lp-bg-grid pattern the
 * landing page uses, plus the navbar's "Capabilio AI" wordmark repeated
 * sparsely (with visible gaps) rather than a dense tiled logo tile. Used
 * by the assessment flow and the dashboard so both feel like the same
 * product as the marketing site.
 */
export function BrandBackdrop({ children }: { children: React.ReactNode }) {
  return (
    <main className="lp-bg-grid relative flex min-h-screen items-center justify-center overflow-hidden bg-lp-surface px-4 py-16">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 grid grid-cols-2 content-start gap-x-10 gap-y-16 p-10 opacity-[0.08] sm:grid-cols-3 md:grid-cols-4"
      >
        {Array.from({ length: BANNER_TILE_COUNT }).map((_, i) => (
          <div key={i} className="flex select-none items-center justify-center gap-2">
            {/* eslint-disable-next-line @next/next/no-img-element -- decorative, repeated many times; a plain img skips Next/Image's per-instance overhead */}
            <img
              src="/logo-mark.jpg"
              alt=""
              width={24}
              height={24}
              loading="lazy"
              decoding="async"
              className="h-6 w-6 shrink-0 rounded object-cover"
            />
            <span className="whitespace-nowrap font-lp-display text-lp-body-lg font-semibold tracking-tight text-lp-text-ink">
              Capabilio <span className="text-lp-accent-ochre">AI</span>
            </span>
          </div>
        ))}
      </div>
      <div className="relative z-10 flex w-full items-center justify-center">{children}</div>
    </main>
  );
}
