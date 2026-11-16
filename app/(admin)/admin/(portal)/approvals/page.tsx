import { requireAdminPage } from "@/lib/admin/db";
import { can, maskEmail } from "@/lib/admin/permissions";
import Link from "next/link";
import clsx from "clsx";
import { AlertTriangle } from "lucide-react";
import { loadQueue, type QueueItem } from "@/lib/admin/approvals";
import { listReviews } from "@/lib/admin/review-store";
import { ageLabel } from "@/lib/admin/rules";
import { DecisionPanel } from "@/components/admin/DecisionPanel";
import { Chip, Empty, PageHeader, CARD } from "@/components/admin/ui";

export const dynamic = "force-dynamic";
const KINDS = [["all", "Everything"], ["mentor", "Mentors"], ["organisation", "Organisations"], ["executive", "Executives"]] as const;
const KIND_LABEL: Record<QueueItem["kind"], string> = { mentor: "Mentor", organisation: "Organisation", executive: "Executive" };

/** Everything waiting for a decision. Reject and hold ask for a reason, which the person reads on their profile and in an email. */
export default async function Approvals({ searchParams }: { searchParams: Promise<{ kind?: string }> }) {
  const admin = await requireAdminPage("lists"); // the layout checks too, but a page fetched on its own must not rely on it
  const show = (e: string | null | undefined) => (can(admin, "contacts") ? e ?? "—" : maskEmail(e));
  const { kind } = await searchParams;
  const [queue, log] = await Promise.all([loadQueue(), listReviews(1)]);
  const active = KINDS.some(([k]) => k === kind) ? (kind as string) : "all";
  const counts = (k: string) => (k === "all" ? queue.length : queue.filter((q) => q.kind === k).length);
  const items = queue.filter((q) => active === "all" || q.kind === active);
  return (
    <div>
      <PageHeader eyebrow="Decisions" title="Approvals" intro="Mentors, college and company accounts, and executive requests. Oldest first, so nobody waits longer than another." />
      {!log.available && (
        <p role="note" className="mb-5 flex items-start gap-2 rounded-2xl border border-[#f3d28a] bg-[#fff6e0] px-4 py-3 font-lp-body text-[13px] text-[#6b4a00]"><AlertTriangle size={16} className="mt-0.5 shrink-0" aria-hidden />The decision log table (migration 204) is not applied yet. Decisions still take effect and the person is still told, but they are not logged, and holds cannot be remembered.</p>
      )}
      <nav aria-label="Filter" className="mb-5 flex flex-wrap gap-2">
        {KINDS.map(([k, label]) => (
          <Link key={k} href={k === "all" ? "/admin/approvals" : `/admin/approvals?kind=${k}`} aria-current={active === k ? "page" : undefined} className={clsx("rounded-full px-4 py-2 font-lp-body text-[13px] font-bold transition-colors", active === k ? "bg-[var(--m-ink)] text-white" : "border border-[var(--m-rule)] bg-white text-[var(--m-ink)] hover:border-[var(--m-ink)]")}>{label} <span className="tabular-nums opacity-70">{counts(k)}</span></Link>
        ))}
      </nav>
      {items.length === 0 ? <Empty title="Nothing waiting">Every request in this view has a decision. New ones appear here as people sign up.</Empty> : (
        <ul className="flex flex-col gap-4">
          {items.map((q) => (
            <li key={`${q.kind}-${q.id}`} className={clsx(CARD, "p-5", q.stale && "border-[#f3d28a]")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><Chip tone="plain">{KIND_LABEL[q.kind]}</Chip>{q.held && <Chip tone="hold">On hold</Chip>}{q.stale && <Chip tone="pending">Waiting {ageLabel(q.submittedAt)}</Chip>}</div>
                  <h2 className="mt-2 font-lp-display text-[18px] font-bold text-[var(--m-ink)]">{q.title}</h2>
                  <p className="font-lp-body text-[13px] text-[var(--m-muted)]">{q.userId ? <Link href={`/admin/people/${q.userId}`} className="font-semibold text-[var(--m-ink)] hover:underline">{q.name}</Link> : <span className="font-semibold text-[var(--m-ink)]">{q.name}</span>}{q.email ? ` · ${q.email}` : ""} · submitted {ageLabel(q.submittedAt)} ago</p>
                  {q.detail && <p className="mt-0.5 font-lp-body text-[12.5px] text-[var(--m-muted)]">{q.detail}</p>}
                </div>
              </div>
              {q.lines.length > 0 && <ul className="mt-3 space-y-1.5 rounded-xl bg-[var(--m-ground)]/70 p-3 font-lp-body text-[13px] leading-relaxed text-[var(--m-ink)]">{q.lines.filter((l) => can(admin, "contacts") || !l.includes("@")).map((l) => <li key={l} className="whitespace-pre-wrap">{l}</li>)}</ul>}
              {q.held?.reason && <p className="mt-3 rounded-xl bg-[#e6e3fb] px-3 py-2 font-lp-body text-[13px] text-[#3d2fb0]">Held: {q.held.reason}</p>}
              {can(admin, "decide") ? <div className="mt-4 border-t border-[var(--m-rule)] pt-4"><DecisionPanel kind={q.kind} id={q.id} name={q.name} /></div> : <p className="mt-4 border-t border-[var(--m-rule)] pt-3 font-lp-body text-[12.5px] text-[var(--m-muted)]">Your role can read this but not decide it.</p>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
