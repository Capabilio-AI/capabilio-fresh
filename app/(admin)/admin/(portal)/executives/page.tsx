import { requireAdminPage } from "@/lib/admin/db";
import { can, maskEmail } from "@/lib/admin/permissions";
import { loadExecutives } from "@/lib/admin/executives";
import { listReviews } from "@/lib/admin/review-store";
import { DecisionPanel } from "@/components/admin/DecisionPanel";
import { Chip, Empty, ExportLink, PageHeader, Section, Stat, Table, TD, when, CARD } from "@/components/admin/ui";

export const dynamic = "force-dynamic";

/** The Executive path is not open yet, so this is its early-access list. Each person can be approved, held or rejected with a reason they will read. */
export default async function Executives() {
  const admin = await requireAdminPage("lists"); // the layout checks too, but a page fetched on its own must not rely on it
  const show = (e: string | null | undefined) => (can(admin, "contacts") ? e ?? "—" : maskEmail(e));
  const [{ waitlist, accounts }, log] = await Promise.all([loadExecutives(), listReviews(1)]);
  const count = (s: string) => waitlist.filter((w) => w.state === s).length;
  return (
    <div>
      <PageHeader eyebrow="Future path" title="Executives" intro="The Executive path is not open yet. These are the people who asked for early access, with their name, email, title and company. When accounts exist, they will appear below with their profiles." actions={can(admin, "export") ? <ExportLink kind="executives" /> : undefined} />
      <div className="mb-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat tone="ink" label="Early access" value={waitlist.length} />
        <Stat label="Waiting" value={count("pending")} />
        <Stat label="On hold" value={count("hold")} />
        <Stat label="Accounts created" value={accounts.length} sub="once the path opens" />
      </div>
      {!log.available && <p role="note" className="mb-4 rounded-2xl border border-[#f3d28a] bg-[#fff6e0] px-4 py-3 font-lp-body text-[13px] text-[#6b4a00]">Decisions are not remembered until the decision log (migration 204) is applied, so a decided person would still show as waiting.</p>}
      {waitlist.length === 0 ? <Empty title="No one yet">People who join the Executive early-access list from the website appear here.</Empty> : (
        <ul className="flex flex-col gap-4">
          {waitlist.map((w) => (
            <li key={w.id} className={`${CARD} p-5`}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="font-lp-display text-[18px] font-bold text-[var(--m-ink)]">{w.name}</h2>
                  <p className="font-lp-body text-[13px] text-[var(--m-muted)]">{show(w.email)} · registered {when(w.joinedAt)}</p>
                  <p className="mt-1 font-lp-body text-[13.5px] text-[var(--m-ink)]">{[w.roleTitle, w.company].filter(Boolean).join(" at ") || "No title or company given"}</p>
                </div>
                <Chip tone={w.state}>{w.state}</Chip>
              </div>
              {w.review?.reason && <p className="mt-3 rounded-xl bg-[var(--m-ground)]/70 px-3 py-2 font-lp-body text-[13px] text-[var(--m-ink)]">{w.state === "rejected" ? "Rejected" : w.state === "hold" ? "Held" : "Approved"}: {w.review.reason}</p>}
              {(w.state === "pending" || w.state === "hold") && can(admin, "decide") && <div className="mt-4 border-t border-[var(--m-rule)] pt-4"><DecisionPanel kind="executive" id={w.id} name={w.name} /></div>}
            </li>
          ))}
        </ul>
      )}
      {accounts.length > 0 && (
        <div className="mt-6"><Section title="Executive accounts">
          <Table head={["Person", "Email", "Created"]}>{accounts.map((a) => <tr key={a.userId}><td className={TD}>{a.name ?? "—"}</td><td className={TD}>{show(a.email)}</td><td className={TD}>{when(a.createdAt)}</td></tr>)}</Table>
        </Section></div>
      )}
    </div>
  );
}
