import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, CalendarDays, ChevronRight, Info } from "lucide-react";
import { orgPageContext } from "@/lib/org/page";
import { loadHome } from "@/lib/org/home";
import { untyped } from "@/lib/org/db";
import { EmptyState, Panel, Pill, Stat, formatDateTime } from "@/components/org/ui";

export const metadata: Metadata = { title: "Home — Capabilio AI" };

const TONE = {
  red: "border-red-200 bg-red-50 text-red-700",
  amber: "border-amber-200 bg-amber-50 text-amber-800",
  blue: "border-blue-200 bg-blue-50 text-blue-800",
} as const;

export default async function OrgHomePage() {
  const { ctx, service } = await orgPageContext();
  const [home, profile] = await Promise.all([
    loadHome(service, ctx),
    untyped(service).from("org_profiles").select("is_public").eq("institution_id", ctx.institutionId).maybeSingle(),
  ]);
  const { kpis, alerts, queue, upcoming } = home;
  const canManage = ctx.kind === "admin" || ctx.kind === "staff";
  const runsPlacements = ctx.kind === "admin" || ctx.kind === "tpo";
  const isPublic = Boolean((profile.data as { is_public: boolean } | null)?.is_public);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <p className="font-lp-mono text-[11px] uppercase tracking-wider text-app-muted">{ctx.institutionName}</p>
        <h1 className="mt-1 font-lp-display text-[28px] font-semibold text-app-charcoal">What needs your attention now?</h1>
      </div>

      {alerts.length > 0 ? (
        <ul className="flex flex-col gap-2" aria-label="Needs attention">
          {alerts.map((a) => (
            <li key={a.label}>
              <Link href={a.href} className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${TONE[a.tone]}`}>
                <AlertTriangle size={16} className="shrink-0" />
                <span className="min-w-0 flex-1">
                  <span className="block font-lp-body text-[13.5px] font-semibold">{a.label}</span>
                  <span className="block font-lp-body text-[12px] opacity-80">{a.sub}</span>
                </span>
                <ChevronRight size={16} className="shrink-0" />
              </Link>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex items-center gap-3 rounded-xl border border-app-border bg-white px-4 py-3">
          <Info size={16} className="shrink-0 text-app-muted" />
          <p className="font-lp-body text-[13px] text-app-muted">Nothing is waiting on you right now.</p>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Active students" value={kpis.students} hint="Signed up under your institution" />
        {canManage && <Stat label="Open projects" value={kpis.openProjects} hint={`${home.counts.awaitingGrading} awaiting grade`} />}
        {runsPlacements && <Stat label="Open drives" value={kpis.openDrives} hint={`${kpis.applicants} applications`} />}
        {runsPlacements && <Stat label="Placed" value={kpis.placed} hint="Confirmed by your team" />}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {canManage && (
          <Panel title="Grading queue">
            {queue.length === 0 ? (
              <EmptyState title="Nothing to grade" body="Groups that submit their work appear here." />
            ) : (
              <ul className="divide-y divide-app-border">
                {queue.map((q) => (
                  <li key={q.groupId}>
                    <Link href={`/org/projects/${q.projectId}`} className="flex items-center justify-between gap-2 py-2.5 hover:bg-black/[0.02]">
                      <span>
                        <span className="block font-lp-body text-[13.5px] font-medium text-app-charcoal">{q.groupName}</span>
                        <span className="block font-lp-mono text-[11px] text-app-muted">{q.projectTitle}</span>
                      </span>
                      <Pill tone="warn">Review</Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </Panel>
        )}
        <Panel title="Coming up">
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing scheduled" body="Events, project deadlines and drive apply-by dates in the next two weeks appear here." />
          ) : (
            <ul className="divide-y divide-app-border">
              {upcoming.map((u) => (
                <li key={`${u.kind}-${u.title}-${u.at}`}>
                  <Link href={u.href} className="flex items-start gap-3 py-2.5 hover:bg-black/[0.02]">
                    <CalendarDays size={15} className="mt-0.5 shrink-0 text-app-muted" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-lp-body text-[13.5px] font-medium text-app-charcoal">{u.title}</span>
                      <span className="block font-lp-mono text-[11px] text-app-muted">
                        {u.detail} · {formatDateTime(u.at)}
                      </span>
                    </span>
                    <Pill>{u.kind}</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      {(ctx.kind === "admin" || ctx.kind === "staff") && !isPublic && (
        <p className="font-lp-body text-[12.5px] text-app-muted">
          Your public page is off.{" "}
          {ctx.kind === "admin" ? (
            <Link href="/org/posts" className="text-app-blue hover:underline">
              Turn it on
            </Link>
          ) : (
            "An admin can turn it on."
          )}
        </p>
      )}
      {isPublic && (
        <p className="font-lp-body text-[12.5px] text-app-muted">
          Public page:{" "}
          <Link href={`/o/${ctx.institutionSlug}`} className="text-app-blue hover:underline">
            /o/{ctx.institutionSlug}
          </Link>
        </p>
      )}
    </div>
  );
}
