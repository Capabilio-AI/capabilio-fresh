"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, Loader2, Trash2 } from "lucide-react";
import { ROLES, ROLE_LABEL, ROLE_SUMMARY, type AdminRole } from "@/lib/admin/permissions";
import type { TeamMember } from "@/lib/admin/team";
import { Chip, Table, TD, when } from "./ui";

const SELECT = "rounded-lg border border-[var(--m-rule)] bg-white px-3 py-2 font-lp-body text-[13px] font-semibold text-[var(--m-ink)]";

async function post(body: object): Promise<{ ok: boolean; error?: string; tempPassword?: string; created?: boolean }> {
  const res = await fetch("/api/admin/team", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const out = (await res.json().catch(() => ({}))) as { error?: string; tempPassword?: string; created?: boolean };
  return { ok: res.ok, ...out };
}

/** The team: add someone with a role and limits, change a role, or take access away. Changes you make to yourself are blocked on the server. */
export function TeamManager({ members, me, rolesAvailable }: { members: TeamMember[]; me: string; rolesAvailable: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<AdminRole>("reviewer");
  const [hide, setHide] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [issued, setIssued] = useState<{ email: string; password: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function run(key: string, body: object, after?: (r: Awaited<ReturnType<typeof post>>) => void) {
    setBusy(key);
    setError(null);
    const r = await post(body);
    setBusy(null);
    if (!r.ok) { setError(r.error ?? "Could not save."); return; }
    after?.(r);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-6">
      {!rolesAvailable && <p role="note" className="rounded-2xl border border-[#f3d28a] bg-[#fff6e0] px-4 py-3 font-lp-body text-[13px] text-[#6b4a00]">Roles are not set up yet. Apply migration 205 (supabase/migrations/205_admin_roles.sql). Until then everyone here is an owner, and adding or changing people is switched off.</p>}

      <section className="rounded-2xl border border-[var(--m-rule)] bg-white p-5">
        <h2 className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">Give someone access</h2>
        <form className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto_auto]" onSubmit={(e) => { e.preventDefault(); void run("add", { action: "add", email, role, hideContacts: hide }, (r) => { setEmail(""); if (r.tempPassword) setIssued({ email: email.trim().toLowerCase(), password: r.tempPassword }); }); }}>
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="their email address" aria-label="Email address" className="rounded-xl border border-[var(--m-rule)] bg-white px-4 py-2.5 font-lp-body text-[14px] outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-accent)]" />
          <select value={role} onChange={(e) => setRole(e.target.value as AdminRole)} aria-label="Role" className={SELECT}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>
          <button type="submit" disabled={!rolesAvailable || busy !== null || !email} className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 font-lp-body text-[13px] font-bold text-white disabled:opacity-40">{busy === "add" && <Loader2 size={14} className="animate-spin" aria-hidden />}Add</button>
        </form>
        <p className="mt-2 font-lp-body text-[12.5px] text-[var(--m-muted)]"><strong className="text-[var(--m-ink)]">{ROLE_LABEL[role]}:</strong> {ROLE_SUMMARY[role]}</p>
        {role === "analyst" && <label className="mt-2 flex items-center gap-2 font-lp-body text-[13px] text-[var(--m-ink)]"><input type="checkbox" checked={hide} onChange={(e) => setHide(e.target.checked)} /> Hide emails and phone numbers from them (this also removes exports)</label>}
        {issued && (
          <div role="status" className="mt-4 rounded-xl border border-[#f3d28a] bg-[#fff6e0] p-4 font-lp-body text-[13px] text-[#6b4a00]">
            <p className="font-bold">Account created for {issued.email}. This password is shown once.</p>
            <p className="mt-1">Send it to them yourself. They must choose their own password at first sign-in at <span className="font-semibold">/admin/login</span>.</p>
            <p className="mt-2 flex items-center gap-2"><code className="rounded-lg bg-white px-3 py-1.5 font-mono text-[13px] text-[var(--m-ink)]">{issued.password}</code>
              <button type="button" onClick={async () => { await navigator.clipboard.writeText(issued.password); setCopied(true); }} className="inline-flex items-center gap-1.5 rounded-full border border-[#e1bb66] px-3 py-1.5 text-[12.5px] font-bold">{copied ? <Check size={13} aria-hidden /> : <Copy size={13} aria-hidden />}{copied ? "Copied" : "Copy"}</button>
              <button type="button" onClick={() => { setIssued(null); setCopied(false); }} className="text-[12.5px] font-bold underline">Done</button></p>
          </div>
        )}
        {error && <p role="alert" className="mt-3 font-lp-body text-[13px] font-semibold text-[#8e1228]">{error}</p>}
      </section>

      <Table head={["Person", "Role", "Contacts", "Last sign-in", ""]}>
        {members.map((m) => {
          const self = m.userId === me;
          return (
            <tr key={m.userId}>
              <td className={TD}><span className="font-bold">{m.name ?? m.email}</span>{self && <span className="ml-2"><Chip tone="plain">you</Chip></span>}{m.mustChange && <span className="ml-2"><Chip tone="pending">has not set a password</Chip></span>}<span className="block text-[12px] text-[var(--m-muted)]">{m.email}</span></td>
              <td className={TD}>{self || !rolesAvailable ? <Chip tone="plain">{ROLE_LABEL[m.role]}</Chip> : <select value={m.role} disabled={busy !== null} onChange={(e) => void run(`r-${m.userId}`, { action: "update", userId: m.userId, role: e.target.value })} aria-label={`Role for ${m.email}`} className={SELECT}>{ROLES.map((r) => <option key={r} value={r}>{ROLE_LABEL[r]}</option>)}</select>}</td>
              <td className={TD}>{m.role === "analyst" && !self && rolesAvailable ? <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={m.hideContacts} disabled={busy !== null} onChange={(e) => void run(`h-${m.userId}`, { action: "update", userId: m.userId, hideContacts: e.target.checked })} /> hidden</label> : m.hideContacts ? "hidden" : "visible"}</td>
              <td className={TD}>{when(m.lastSignIn)}</td>
              <td className={`${TD} text-right`}>{!self && <button type="button" disabled={busy !== null} onClick={() => { if (window.confirm(`Remove console access for ${m.email}? Their account stays.`)) void run(`d-${m.userId}`, { action: "remove", userId: m.userId }); }} aria-label={`Remove ${m.email}`} className="inline-flex items-center gap-1.5 rounded-full border border-[#f2c3cc] px-3 py-1.5 font-lp-body text-[12.5px] font-bold text-[#8e1228] hover:bg-[#fde3e8] disabled:opacity-40"><Trash2 size={13} aria-hidden />Remove</button>}</td>
            </tr>
          );
        })}
      </Table>
    </div>
  );
}
