import { requireAdminPage } from "@/lib/admin/db";
import { can, maskEmail } from "@/lib/admin/permissions";
import { AlertTriangle } from "lucide-react";
import { listReviews } from "@/lib/admin/review-store";
import { Chip, Empty, ExportLink, PageHeader, Table, TD, whenTime } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/** Every decision, with the reason the person was given and whether the in-app notice and the email went out. */
export default async function Decisions() {
  const admin = await requireAdminPage("lists"); // the layout checks too, but a page fetched on its own must not rely on it
  const show = (e: string | null | undefined) => (can(admin, "contacts") ? e ?? "—" : maskEmail(e));
  const { available, rows } = await listReviews(200);
  return (
    <div>
      <PageHeader eyebrow="Accountability" title="Decision log" intro="Who decided what, when, why, and whether the person was told in the app and by email." actions={can(admin, "export") ? <ExportLink kind="decisions" /> : undefined} />
      {!available ? (
        <p role="note" className="flex items-start gap-2 rounded-2xl border border-[#f3d28a] bg-[#fff6e0] px-4 py-3 font-lp-body text-[13px] text-[#6b4a00]"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />The log table is not there yet. Apply migration 204 (supabase/migrations/204_admin_reviews.sql) and decisions will be recorded from then on.</p>
      ) : rows.length === 0 ? <Empty title="No decisions yet">Approve, hold or reject something in Approvals and it is logged here.</Empty> : (
        <Table head={["When", "About", "Decision", "Reason given", "In app", "Email"]}>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className={`${TD} whitespace-nowrap`}>{whenTime(r.decidedAt)}</td>
              <td className={TD}><span className="font-bold capitalize">{r.subjectType}</span><span className="block text-[12px] text-[var(--m-muted)]">{r.label ?? "—"}</span></td>
              <td className={TD}><Chip>{r.decision}</Chip></td>
              <td className={`${TD} max-w-[300px]`}>{r.reason ?? <span className="text-[var(--m-muted)]">—</span>}</td>
              <td className={TD}><Chip tone={r.inApp === "sent" ? "sent" : "plain"}>{r.inApp === "sent" ? "told" : "no"}</Chip></td>
              <td className={TD}><Chip tone={r.email === "sent" ? "sent" : r.email === "failed" ? "failed" : "plain"}>{r.email === "not_configured" ? "not set up" : r.email}</Chip></td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
