import type { Metadata } from "next";
import Link from "next/link";
import { Check, ChevronRight } from "lucide-react";
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

  const today = new Date().toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div className="flex flex-col gap-8">
      <section className="ws-hero p-6 md:p-8" aria-label="College snapshot">
        <span aria-hidden className="pointer-events-none absolute -right-12 -top-16 h-56 w-56 rounded-full border-[26px] border-[#e0a30c]/45" />
        <span aria-hidden className="pointer-events-none absolute right-40 top-28 hidden h-3.5 w-3.5 rounded-full bg-[#e0a30c] md:block" />
        <div className="relative">
          <p className="text-[13px] font-semibold text-[#fff]/65">
            {today} · {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          </p>
          <h1 className="o-serif mt-2 max-w-3xl text-[30px] leading-[1.08] text-[#fff] md:text-[42px]">{ctx.institutionName}</h1>
          <p className="mt-2 text-[14px] text-[#fff]/75">{alerts.length === 0 ? "Nothing needs you right now." : `${alerts.length} ${alerts.length === 1 ? "item needs" : "items need"} your attention.`}</p>
        </div>
        <dl className="relative mt-6 grid grid-cols-2 gap-3 md:grid-cols-4">
          {kpiCards.map((k) => (
            <Link key={k.label} href={k.href} className="glass-dark block rounded-2xl p-4 transition-colors hover:bg-[#fff]/20">
              <dt className="text-[12.5px] font-semibold text-[#fff]/70">{k.label}</dt>
              <dd className="mt-1.5 text-[32px] font-extrabold leading-none tracking-[-0.03em] text-[#fff]">{k.value}</dd>
              <dd className="mt-1.5 text-[12px] text-[#fff]/65">{k.sub}</dd>
            </Link>
          ))}
        </dl>
      </section>

      {showSetup && (
        <section className="o-card p-5" aria-label="Set up your college page">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-bold text-app-charcoal">Set up your college</h2>
              <p className="mt-0.5 text-[13px] text-app-muted">
                {doneCount} of {steps.length} done. Each step is checked against what is actually in your account.
              </p>
            </div>
            <span className="h-2 w-44 overflow-hidden rounded-full bg-white/[0.08]" role="img" aria-label={`${doneCount} of ${steps.length} steps done`}>
              <span className="block h-full rounded-full" style={{ width: `${(doneCount / steps.length) * 100}%`, background: "var(--o-gradient)" }} />
            </span>
          </div>
          <ul className="mt-4 grid grid-cols-1 gap-x-8 md:grid-cols-2">
            {steps.map((s) => (
              <li key={s.label} className="border-t border-app-border first:border-t-0 md:[&:nth-child(2)]:border-t-0">
                <Link href={s.href} className="flex items-start gap-3 rounded-lg px-1 py-3 hover:bg-white/[0.04]">
                  <span
                    className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded ${s.done ? "bg-app-success text-[#fff]" : "border-[1.5px] border-[var(--m-soft,#d9cba3)] text-transparent"}`}
                    aria-hidden="true"
                  >
                    <Check size={13} strokeWidth={3} />
                  </span>
                  <span>
                    <span className={`block text-[13.5px] font-semibold ${s.done ? "text-app-muted line-through" : "text-app-charcoal"}`}>{s.label}</span>
                    {!s.done && <span className="block text-[12.5px] text-app-muted">{s.hint}</span>}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)]">
        <div className="flex flex-col gap-6">
          <section aria-label="Needs attention">
            <h2 className="mb-2.5 text-[15px] font-bold text-app-charcoal">Needs attention</h2>
            {alerts.length === 0 ? (
              <EmptyState title="All clear" body="Pending approvals, ungraded work and drives needing action show up here." />
            ) : (
              <ul className="o-card ws-rows overflow-hidden">
                {alerts.map((a) => (
                  <li key={a.label}>
                    <Link href={a.href} className="flex items-center gap-3.5 px-4 py-3.5 transition-colors hover:bg-white/[0.035]">
                      <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${ALERT[a.tone].dot}`} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[14px] font-semibold text-app-charcoal">{a.label}</span>
                        <span className="block text-[12.5px] text-app-muted">{a.sub}</span>
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-app-muted" aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {canManage && (
            <section aria-label="Grading queue">
              <div className="mb-2.5 flex items-center justify-between">
                <h2 className="text-[15px] font-bold text-app-charcoal">Grading queue</h2>
                <Link href="/org/projects" className="text-[12.5px] font-semibold text-app-orange hover:underline">
                  All projects
                </Link>
              </div>
              {queue.length === 0 ? (
                <EmptyState title="Nothing to grade" body="When a group submits its work it shows up here for your review." />
              ) : (
                <ul className="o-card ws-rows overflow-hidden">
                  {queue.map((q) => (
                    <li key={q.groupId}>
                      <Link href={`/org/projects/${q.projectId}`} className="grid grid-cols-[36px_1fr_auto] items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.035]">
                        <span className="grid h-9 w-9 place-items-center rounded-lg bg-app-orange-container text-[14px] font-extrabold text-app-orange">{q.groupName.charAt(0).toUpperCase()}</span>
                        <span className="min-w-0">
                          <span className="block truncate text-[13.5px] font-semibold text-app-charcoal">{q.groupName}</span>
                          <span className="block truncate text-[12.5px] text-app-muted">{q.projectTitle}</span>
                        </span>
                        <Pill tone="warn">Review</Pill>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        <section aria-label="Coming up">
          <h2 className="mb-2.5 text-[15px] font-bold text-app-charcoal">Coming up</h2>
          {upcoming.length === 0 ? (
            <EmptyState title="Nothing scheduled" body="Events, project deadlines and drive apply-by dates in the next two weeks appear here." />
          ) : (
            <ul className="o-card ws-rows overflow-hidden">
              {upcoming.map((u) => {
                const at = new Date(u.at);
                return (
                  <li key={`${u.kind}-${u.title}-${u.at}`}>
                    <Link href={u.href} className="flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/[0.035]">
                      <span className="ws-date" aria-hidden="true">
                        <b>{at.toLocaleDateString("en-IN", { day: "2-digit" })}</b>
                        <span>{at.toLocaleDateString("en-IN", { month: "short" })}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-app-charcoal">{u.title}</span>
                        <span className="block truncate text-[12.5px] text-app-muted">
                          {u.detail} · {formatDateTime(u.at)}
                        </span>
                      </span>
                      <Pill tone={KIND_TONE[u.kind]}>{u.kind}</Pill>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
