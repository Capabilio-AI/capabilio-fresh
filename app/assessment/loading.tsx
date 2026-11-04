// Shown the moment sign-in lands here, while the server builds the page (and, for finished students, redirects to the dashboard).
export default function AssessmentLoading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse px-5 py-16" role="status" aria-label="Loading your workspace">
      <div className="h-8 w-56 rounded-md bg-black/10" />
      <div className="mt-3 h-4 w-80 max-w-full rounded-md bg-black/5" />
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-28 rounded-xl border border-black/10 bg-white" />
        ))}
      </div>
    </div>
  );
}
