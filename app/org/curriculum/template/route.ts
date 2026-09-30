import { CSV_SAMPLE } from "@/lib/roadmap/csv";

/** Starter file for the curriculum import. Static and non-sensitive, so no session is needed. */
export function GET() {
  return new Response(CSV_SAMPLE, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="curriculum-template.csv"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
