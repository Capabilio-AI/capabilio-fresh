import type { Metadata } from "next";
import Link from "next/link";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { requireStage } from "@/lib/stage/guard";
import { listAlerts } from "@/lib/professional/notifications";
import { agoLabel } from "@/lib/professional/pulse";
import { MarkRead } from "@/components/professional/home/MarkRead";

export const metadata: Metadata = { title: "Alerts — Capabilio AI" };

/** Alerts for a working professional: a mentee asking for one of your slots, a request cancelled. */
export default async function ProfessionalAlerts() {
  await requireStage(["professional"]);
  const { user } = await requireAuthedUser();
  const alerts = await listAlerts(user.id).catch((e: Error) => {
    console.error("[professional/alerts] load failed:", e.message);
    return null;
  });
  const now = new Date();
  const unread = alerts?.filter((a) => !a.read).length ?? 0;
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-lp-display text-[32px] font-bold leading-[1.05] tracking-tight text-[var(--m-ink)] sm:text-[40px]">Alerts</h1>
          <p className="mt-1 text-[14px] text-[var(--m-muted)]">{unread > 0 ? `${unread} new` : "You are up to date."}</p>
        </div>
        {unread > 0 && <MarkRead />}
      </header>
      {!alerts ? <p role="alert" className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 text-[14.5px] text-[var(--m-ink)]">Your alerts could not load right now. Please try again in a moment.</p> : alerts.length === 0 ? <p className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 text-[14.5px] text-[var(--m-muted)]">No alerts yet. When a mentee asks for one of your slots, it shows up here.</p> : (
        <ul className="flex flex-col gap-3">
          {alerts.map((a) => (
            <li key={a.id} className={`rounded-3xl border p-5 ${a.read ? "border-[var(--m-rule)] bg-white" : "border-[var(--m-ink)] bg-white"}`}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[15px] font-bold text-[var(--m-ink)]">{!a.read && <span className="mr-2 inline-block size-2 rounded-full bg-[var(--m-accent)] align-middle" aria-label="New" />}{a.title}</p>
                  {a.body && <p className="mt-1 text-[14px] text-[var(--m-ink)]">{a.body}</p>}
                  <p className="mt-1 text-[12.5px] text-[var(--m-muted)]">{agoLabel(a.createdAt, now)}</p>
                </div>
                {a.link && <Link href={a.link} className="shrink-0 rounded-full border border-[var(--m-rule)] px-4 py-1.5 text-[13px] font-bold text-[var(--m-ink)] hover:border-[var(--m-ink)]">{a.kind === "mentor_request" ? "Review" : "Open"}</Link>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
