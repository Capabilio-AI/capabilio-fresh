import type { Metadata } from "next";
import Link from "next/link";
import { orgPageContext } from "@/lib/org/page";
import { isOpen, listRequests, REQUEST_STATUS } from "@/lib/org/requests";
import { ActionButton } from "@/components/org/ActionButton";
import { EmptyState, PageHeader, Panel, Pill } from "@/components/org/ui";

export const metadata: Metadata = { title: "Requests — Company — Capabilio AI" };

const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "UTC" });

export default async function CompanyRequestsPage() {
  const { ctx, service } = await orgPageContext();
  const all = await listRequests(service, "company", ctx.institutionId);
  const open = all.filter((r) => isOpen(r.status));
  const past = all.filter((r) => !isOpen(r.status));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Requests" subtitle="Colleges that want you to visit their campus. Accept to open a conversation with them, or decline." />
      <Panel title={`Waiting for your reply (${open.length})`}>
        {open.length === 0 ? (
          <EmptyState title="Nothing waiting" body="When a college invites you to a campus visit, it appears here and in your notifications." />
        ) : (
          <ul className="divide-y divide-[var(--m-rule)]!">
            {open.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 py-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-[14.5px] font-bold text-[var(--m-ink)]">{r.otherName}</p>
                  <p className="text-[13px] text-[var(--m-muted)]">
                    {r.role}
                    {r.proposedDate ? ` · ${day(r.proposedDate)}` : ""}
                    {r.location ? ` · ${r.location}` : ""}
                  </p>
                  <p className="mt-2 max-w-xl whitespace-pre-wrap text-[13.5px] leading-relaxed text-[var(--m-ink)]">{r.message}</p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <ActionButton action="/api/company/requests" body={{ id: r.id, decision: "accept" }} label="Accept" />
                  <ActionButton action="/api/company/requests" body={{ id: r.id, decision: "decline" }} label="Decline" variant="danger" confirm={`Decline ${r.otherName}'s invitation?`} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>
      {past.length > 0 && (
        <Panel title="Earlier requests">
          <ul className="divide-y divide-[var(--m-rule)]!">
            {past.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-[var(--m-ink)]">{r.otherName}</p>
                  <p className="text-[12.5px] text-[var(--m-muted)]">{r.role}{r.proposedDate ? ` · ${day(r.proposedDate)}` : ""}</p>
                </div>
                <div className="flex items-center gap-3">
                  <Pill tone={REQUEST_STATUS[r.status]?.tone}>{REQUEST_STATUS[r.status]?.label ?? r.status}</Pill>
                  {r.status === "accepted" && <Link href={`/company/messages?with=${r.collegeId}`} className="text-[13px] font-bold text-[var(--m-accent-ink)] hover:underline">Message</Link>}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
