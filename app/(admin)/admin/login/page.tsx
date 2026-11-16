import type { Metadata } from "next";
import { redirect } from "next/navigation";
import Image from "next/image";
import "@/components/metro/metro.css";
import { metroFontVars } from "@/components/metro/font";
import { getAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { isPlatformAdmin } from "@/lib/arena-content/store";
import { AdminLogin } from "@/components/admin/AdminLogin";
import { SignOutButton } from "@/components/admin/SignOutButton";

export const metadata: Metadata = { title: "Console sign-in — Capabilio AI", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

/** The Capabilio admin sign-in. Separate from the student, college, company and professional sign-ins: it only admits platform admins. */
export default async function AdminLoginPage() {
  const { user } = await getAuthedUser();
  const admin = user ? await isPlatformAdmin(createServiceClient(), user.id) : false;
  if (user && admin) redirect("/admin");
  return (
    <div className={`metro ${metroFontVars} grid min-h-screen place-items-center bg-[var(--m-ground)] px-4 py-10`} data-area="admin">
      <main className="w-full max-w-[420px]">
        <Image src="/brand/capabilio-logo.png" alt="Capabilio AI" width={1130} height={234} priority className="mx-auto mb-8 h-[44px] w-auto" />
        <div className="rounded-3xl border border-[var(--m-rule)] bg-white p-7 shadow-[0_24px_60px_-34px_rgb(21_17_13/0.45)] sm:p-8">
          <p className="font-lp-body text-[11.5px] font-bold uppercase tracking-[0.16em] text-[var(--m-accent-ink)]">Capabilio Console</p>
          {user && !admin ? (
            <>
              <h1 className="mt-1 font-lp-display text-[26px] font-bold leading-tight text-[var(--m-ink)]">This account is not a Capabilio admin</h1>
              <p className="mt-2 font-lp-body text-[14px] leading-relaxed text-[var(--m-muted)]">You are signed in as <strong className="text-[var(--m-ink)]">{user.email}</strong>. The console is only for Capabilio platform admins. A college, company, student or professional login cannot open it, and nothing about that account has changed.</p>
              <div className="mt-5"><SignOutButton /></div>
            </>
          ) : (
            <>
              <h1 className="mt-1 font-lp-display text-[26px] font-bold leading-tight text-[var(--m-ink)]">Admin sign-in</h1>
              <p className="mb-5 mt-2 font-lp-body text-[14px] leading-relaxed text-[var(--m-muted)]">For the Capabilio team only. Use your admin account, not a college or company login.</p>
              <AdminLogin />
            </>
          )}
        </div>
      </main>
    </div>
  );
}
