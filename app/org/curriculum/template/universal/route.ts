import { templateCsv } from "@/lib/curriculum/template/spec";

/** The Capabilio curriculum template: static and non-sensitive, so no session is needed. */
export function GET() {
  return new Response(templateCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="capabilio-curriculum-template.csv"',
      "Cache-Control": "public, max-age=3600",
    },
  });
}
