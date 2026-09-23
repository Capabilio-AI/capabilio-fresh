import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { getViewerSummary } from "@/lib/dashboard/viewer";
import { EditableNameForm } from "@/components/settings/EditableNameForm";

export const metadata: Metadata = { title: "Settings — Capabilio AI" };

export default async function SettingsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const viewer = await getViewerSummary(supabase, user.id);

  return (
    <div className="max-w-2xl">
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Settings</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Manage your account and profile details.</p>

      <div className="mt-6 flex flex-col gap-5">
        <section className="rounded-xl border border-app-border bg-white p-5">
          <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Account</h2>
          <div className="mt-3">
            <p className="font-lp-body text-[13.5px] text-app-charcoal">{viewer.email}</p>
            <p className="mt-1 font-lp-mono text-[11px] text-app-muted">Contact support to change your email.</p>
          </div>
        </section>

        <section className="rounded-xl border border-app-border bg-white p-5">
          <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Profile</h2>
          <div className="mt-3">
            <label className="mb-1.5 block font-lp-mono text-[11px] uppercase tracking-wide text-app-muted">
              Full name
            </label>
            <EditableNameForm initialName={viewer.fullName ?? ""} />
          </div>
        </section>

        <section className="rounded-xl border border-app-border bg-white p-5">
          <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Academic</h2>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <p className="font-lp-mono text-[11px] uppercase tracking-wide text-app-muted">College</p>
              <p className="mt-1 font-lp-body text-[13.5px] text-app-charcoal">{viewer.collegeName ?? "—"}</p>
            </div>
            <div>
              <p className="font-lp-mono text-[11px] uppercase tracking-wide text-app-muted">Branch</p>
              <p className="mt-1 font-lp-body text-[13.5px] text-app-charcoal">{viewer.branch ?? "—"}</p>
            </div>
            <div>
              <p className="font-lp-mono text-[11px] uppercase tracking-wide text-app-muted">Year</p>
              <p className="mt-1 font-lp-body text-[13.5px] text-app-charcoal">{viewer.year ?? "—"}</p>
            </div>
          </div>
          <p className="mt-3 font-lp-mono text-[11px] text-app-muted">
            To update your college, branch, or year, contact your institution admin.
          </p>
        </section>
      </div>
    </div>
  );
}
