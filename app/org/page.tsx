import type { Metadata } from "next";
import Link from "next/link";
import { CalendarDays, Check, ChevronRight } from "lucide-react";
import { orgPageContext } from "@/lib/org/page";
import { loadHome } from "@/lib/org/home";
import { buildSetupChecklist } from "@/lib/org/setup";
import { untyped } from "@/lib/org/db";
import { EmptyState, Pill, formatDateTime } from "@/components/org/ui";

export const metadata: Metadata = { title: "Home — Capabilio AI" };

const ALERT = {
  red: { bar: "border-app-rose/30 bg-app-rose-container", dot: "bg-app-rose" },
  amber: { bar: "border-app-orange/30 bg-app-orange-container", dot: "bg-app-orange" },
  blue: { bar: "border-app-blue/30 bg-app-blue-container", dot: "bg-app-blue" },
} as const;

const KIND_TONE = { event: "info", project: "warn", drive: "ok" } as const;

export default async function OrgHomePage() {
  const { ctx, service } = await orgPageContext();
  const db = untyped(service);
  const [home, profileRes, postsRes, matsRes, projRes, driveRes, nameRes] = await Promise.all([
    loadHome(service, ctx),
    db.from("org_profiles").select("is_public, bio, website_url").eq("institution_id", ctx.institutionId).maybeSingle(),
    db.from("org_posts").select("id", { count: "exact", head: true }).eq("institution_id", ctx.institutionId).eq("status", "published"),
    db.from("class_materials").select("id", { count: "exact", head: true }).eq("institution_id", ctx.institutionId),
    db.from("class_projects").select("id", { count: "exact", head: true }).eq("institution_id", ctx.institutionId),
    service.from("opportunities").select("id", { count: "exact", head: true }).eq("institution_id", ctx.institutionId),
    service.from("profiles").select("full_name").eq("id", ctx.userId).maybeSingle(),
  ]);
  const { kpis, alerts, queue, upcoming } = home;
  const canManage = ctx.permissions.has("classroom");
  const runsPlacements = ctx.permissions.has("placements");
  const profile = (profileRes.data as { is_public: boolean; bio: string | null; website_url: string | null } | null) ?? null;
  const firstName = nameRes.data?.full_name?.trim().split(/\s+/)[0];

  const steps = buildSetupChecklist({
    profilePublic: Boolean(profile?.is_public),
    hasBio: Boolean(profile?.bio),
    hasWebsite: Boolean(profile?.website_url),
    publishedPosts: postsRes.count ?? 0,
    materials: matsRes.count ?? 0,
    projects: projRes.count ?? 0,
    drives: driveRes.count ?? 0,
    students: kpis.students,
  });
  const doneCount = steps.filter((s) => s.done).length;
  const showSetup = ctx.permissions.has("members") && doneCount < steps.length;

  const kpiCards = [
    { label: "Active students", value: kpis.students, sub: "Signed up under your college", href: ctx.permissions.has("students") ? "/org/students" : ctx.permissions.has("insights") ? "/org/insights" : "/org", tone: "text-app-charcoal" },
    canManage && { label: "Open projects", value: kpis.openProjects, sub: `${home.counts.awaitingGrading} awaiting a grade`, href: "/org/projects", tone: "text-app-orange" },
    runsPlacements && { label: "Company visits", value: kpis.openDrives, sub: `${kpis.applicants} applications`, href: "/org/placements", tone: "text-app-blue" },
    runsPlacements && { label: "Placed", value: kpis.placed, sub: "Confirmed by your team", href: "/org/outcomes", tone: "text-app-success" },
  ].filter(Boolean) as { label: string; value: number; sub: string; href: string; tone: string }[];

  return (
    <div className="flex flex-col gap-7">
      <header>
        <p className="o-eyebrow">{firstName ? `Welcome back, ${firstName}` : ctx.institutionName}</p>
        <h1 className="o-serif mt-2 text-[46px] leading-[0.98] text-app-charcoal">
          What needs your <span className="text-app-orange">attention</span> now?
        </h1>
      </header>

      {alerts.length > 0 && (
        <ul className="flex flex-col gap-2" aria-label="Needs attention">
          {alerts.map((a) => (
            <li key={a.label}>
              <Link href={a.href} className={`flex items-center gap-3.5 rounded-2xl border px-4 py-3.5 transition-colors hover:brightness-110 ${ALERT[a.tone].bar}`}>
                <span className={`h-2 w-2 shrink-0 rounded-full ${ALERT[a.tone].dot}`} aria-hidden="true" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[13.5px] font-bold text-app-charcoal">{a.label}</span>
                  <span className="block text-[12px] text-app-muted">{a.sub}</span>
                </span>
                <ChevronRight size={16} className="shrink-0 text-app-muted" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {kpiCards.map((k) => (
          <Link key={k.label} href={k.href} className="o-card block min-h-[112px] p-4">
            <p className="o-eyebrow">{k.label}</p>
            <p className={`mt-3 text-[34px] font-black leading-none tracking-[-0.04em] ${k.tone}`}>{k.value}</p>
            <p className="mt-2 text-[11.5px] text-app-muted">{k.sub}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {canManage && (
          <section className="o-card p-5">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[13px] font-extrabold text-app-charcoal">Grading queue</h2>
              <Link href="/org/projects" className="text-[11.5px] font-bold text-app-orange hover:underline">
                All projects
              </Link>
            </div>
            {queue.length === 0 ? (
              <EmptyState title="Nothing to grade" body="When a group submits its work it shows up here for your review." />
            ) : (
              <ul>
                {queue.map((q, i) => (
                  <li key={q.groupId} className={i === 0 ? "" : "border-t border-app-border"}>
                    <Link href={`/org/projects/${q.projectId}`} className="grid grid-cols-[40px_1fr_auto] items-center gap-3 py-3.5">
                      <span className="grid h-10 w-10 place-items-center rounded-[14px] border border-app-border bg-white/[0.05] text-[14px] font-black text-app-orange">{q.groupName.charAt(0).toUpperCase()}</span>
                      <span className="min-w-0">
                        <span className="block truncate text-[13px] font-bold text-app-charcoal">{q.groupName}</span>
                        <span className="block truncate text-[11.5px] text-app-muted">{q.projectTitle}</span>
                      </span>
                      <Pill tone="warn">Review</Pill>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}

        <section className="o-card p-5">
          <h2 className="mb-3 text-[13px] font-extrabold text-app-charcoal">Coming up</h2>
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing scheduled" body="Events, project deadlines and drive apply-by dates in the next two weeks appear here." />
          ) : (
            <ul>
              {upcoming.map((u, i) => (
                <li key={`${u.kind}-${u.title}-${u.at}`} className={i === 0 ? "" : "border-t border-app-border"}>
                  <Link href={u.href} className="grid grid-cols-[40px_1fr_auto] items-center gap-3 py-3.5">
                    <span className="grid h-10 w-10 place-items-center rounded-[14px] border border-app-border bg-white/[0.05] text-app-muted">
                      <CalendarDays size={16} aria-hidden="true" />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[13px] font-bold text-app-charcoal">{u.title}</span>
                      <span className="block truncate text-[11.5px] text-app-muted">
                        {u.detail} · {formatDateTime(u.at)}
                      </span>
                    </span>
                    <Pill tone={KIND_TONE[u.kind]}>{u.kind}</Pill>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {showSetup && (
        <section className="o-card p-5" aria-label="Set up your college page">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[15px] font-extrabold text-app-charcoal">Set up your college</h2>
              <p className="mt-0.5 text-[12.5px] text-app-muted">
                {doneCount} of {steps.length} done. Each step is checked against what is actually in your account.
              </p>
            </div>
            <span className="h-1.5 w-40 overflow-hidden rounded-full bg-white/[0.07]" role="img" aria-label={`${doneCount} of ${steps.length} steps done`}>
              <span className="block h-full rounded-full" style={{ width: `${(doneCount / steps.length) * 100}%`, background: "var(--o-gradient)" }} />
            </span>
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-x-8 gap-y-1 md:grid-cols-2">
            {steps.map((s) => (
              <li key={s.label}>
                <Link href={s.href} className="flex items-start gap-3 rounded-xl px-2 py-2.5 hover:bg-white/[0.04]">
                  <span
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md text-[11px] ${s.done ? "bg-app-success-container text-app-success" : "border border-app-border text-transparent"}`}
                    aria-hidden="true"
                  >
                    <Check size={12} strokeWidth={3} />
                  </span>
                  <span>
                    <span className={`block text-[13px] font-semibold ${s.done ? "text-app-muted line-through" : "text-app-charcoal"}`}>{s.label}</span>
                    {!s.done && <span className="block text-[11.5px] text-app-muted">{s.hint}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
