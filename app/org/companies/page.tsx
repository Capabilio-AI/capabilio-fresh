import type { Metadata } from "next";
import Link from "next/link";
import { orgPageContext } from "@/lib/org/page";
import { isOpen, listApprovedCompanies, listRequests, REQUEST_STATUS } from "@/lib/org/requests";
import { ActionButton } from "@/components/org/ActionButton";
import { JsonForm } from "@/components/org/JsonForm";
import { companyTabs } from "@/lib/org/section-tabs";
import { SectionTabs } from "@/components/org/SectionTabs";
import { Collapsible, EmptyState, PageHeader, Panel, Pill } from "@/components/org/ui";

export const metadata: Metadata = { title: "Companies — Capabilio AI" };

const day = (d: string) => new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { dateStyle: "medium", timeZone: "UTC" });

export default async function CompaniesPage() {
  const { ctx, service } = await orgPageContext("postPlacement");
  const [companies, sent] = await Promise.all([listApprovedCompanies(service), listRequests(service, "college", ctx.institutionId)]);
  const pendingTo = new Set(sent.filter((r) => isOpen(r.status)).map((r) => r.companyId));

  return (
    <div className="flex flex-col gap-6">
      <SectionTabs label="Company sections" active="/org/companies" tabs={companyTabs()} />
      <PageHeader title="Companies" subtitle="Companies approved on Capabilio. Invite one to visit your campus, or message them. Once they accept, record the visit under Company visits." />

      <Panel title={`Companies on Capabilio (${companies.length})`}>
        {companies.length === 0 ? (
          <EmptyState title="No companies yet" body="Approved companies appear here as they join Capabilio." />
        ) : (
          <ul className="divide-y divide-[var(--m-rule)]!">
            {companies.map((c) => (
              <li key={c.id} className="py-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-[14.5px] font-bold text-[var(--m-ink)]">{c.name}</p>
                    {c.city && <p className="text-[12.5px] text-[var(--m-muted)]">{c.city}</p>}
                  </div>
                  <div className="flex items-center gap-4 text-[13px] font-bold">
                    <Link href={`/c/${c.slug}`} target="_blank" rel="noopener noreferrer" className="text-[var(--m-accent-ink)] hover:underline">View page</Link>
                    <Link href={`/org/companies/messages?with=${c.id}`} className="text-[var(--m-accent-ink)] hover:underline">Message</Link>
                  </div>
                </div>
                <div className="mt-3">
                  {pendingTo.has(c.id) ? (
                    <Pill tone="info">Invitation sent, waiting for a reply</Pill>
                  ) : (
                    <Collapsible title="Invite to visit your campus">
                      <JsonForm
                        action="/api/org/company-requests"
                        extra={{ companyId: c.id }}
                        submitLabel="Send invitation"
                        successMessage="Invitation sent."
                        fields={[
                          { name: "role", label: "Role or purpose", placeholder: "Software engineer, 2027 batch", required: true },
                          { name: "proposedDate", label: "Preferred date", type: "date" },
                          { name: "location", label: "Where", placeholder: "Our campus, Vijayawada" },
                          { name: "message", label: "Note to the company", type: "textarea", required: true, placeholder: "Tell them who you would like them to meet and why." },
                        ]}
                      />
                    </Collapsible>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      {sent.length > 0 && (
        <Panel title="Invitations you have sent">
          <ul className="divide-y divide-[var(--m-rule)]!">
            {sent.map((r) => (
              <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-[14px] font-bold text-[var(--m-ink)]">{r.otherName}</p>
                  <p className="text-[12.5px] text-[var(--m-muted)]">{r.role}{r.proposedDate ? ` · ${day(r.proposedDate)}` : ""}</p>
                  {r.responseNote && <p className="mt-1 text-[12.5px] text-[var(--m-ink)]">&ldquo;{r.responseNote}&rdquo;</p>}
                </div>
                <div className="flex items-center gap-3">
                  <Pill tone={REQUEST_STATUS[r.status]?.tone}>{REQUEST_STATUS[r.status]?.label ?? r.status}</Pill>
                  {isOpen(r.status) && <ActionButton action="/api/org/company-requests/cancel" body={{ id: r.id }} label="Cancel" variant="ghost" confirm="Cancel this invitation?" />}
                </div>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </div>
  );
}
