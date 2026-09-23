// Next.js shows this instantly on every navigation inside the (app) group
// while the next route's server work runs, instead of a blank screen —
// the App Router wraps each route segment in Suspense keyed to this file.
export default function AppLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-8 w-48 rounded-md bg-app-border/60" />
      <div className="mt-3 h-4 w-72 rounded-md bg-app-border/40" />
      <div className="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl border border-app-border bg-white" />
        ))}
      </div>
    </div>
  );
}
