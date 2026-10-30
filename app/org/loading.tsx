/** Shown instantly while an /org page fetches its data, so navigation feels immediate instead of frozen. */
export default function OrgLoading() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true" aria-label="Loading">
      <div className="h-40 animate-pulse rounded-3xl bg-black/5 md:h-48" />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-24 animate-pulse rounded-2xl bg-black/5" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-2xl bg-black/5" />
    </div>
  );
}
