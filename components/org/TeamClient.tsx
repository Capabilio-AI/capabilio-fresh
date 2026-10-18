"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Mail, MessageCircle } from "lucide-react";
import { INVITABLE_ROLES, ROLE_DEFAULTS, effectivePermissions, kindOf, type OrgPermissionKey } from "@/lib/org/roles";
import { CopyButton } from "./CopyButton";
import { PermissionPicker } from "./PermissionPicker";

async function post(url: string, body: unknown): Promise<{ ok: boolean; data: Record<string, unknown> | null; error?: string }> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = (await res.json().catch(() => null)) as Record<string, unknown> | null;
    return { ok: res.ok, data, error: res.ok ? undefined : ((data?.error as string | undefined) ?? "Something went wrong.") };
  } catch {
    return { ok: false, data: null, error: "Connection problem. Please try again." };
  }
}

const sameSet = (a: readonly string[], b: readonly string[]) => a.length === b.length && a.every((x) => b.includes(x));

function defaultsFor(role: string): OrgPermissionKey[] {
  const kind = kindOf(role);
  return kind ? [...ROLE_DEFAULTS[kind]] : [];
}

interface InviteResult {
  url: string;
  email: string;
  roleLabel: string;
  expiresAt: string;
  /** true when the server emailed the invitation itself */
  emailSent: boolean;
}

function resultFrom(r: { data: Record<string, unknown> | null }, role: string): InviteResult {
  return {
    url: String(r.data?.inviteUrl),
    email: String(r.data?.email),
    roleLabel: INVITABLE_ROLES.find((x) => x.role === role)?.label ?? role,
    expiresAt: String(r.data?.expiresAt),
    emailSent: r.data?.emailSent === true,
  };
}

/** Share panel: the link works only for the invited email, once, for seven days. Email is opened in the admin's own mail app. */
function InviteShare({ result, institutionName, onDone }: { result: InviteResult; institutionName: string; onDone: () => void }) {
  const subject = `Your invitation to join ${institutionName} on Capabilio`;
  const message = `Hi,\n\nYou've been invited to join ${institutionName} on Capabilio as ${result.roleLabel}.\nOpen this link to create your account (it works once, for 7 days):\n${result.url}\n`;
  return (
    <div className="rounded-2xl border border-app-success/30 bg-app-success-container p-4" role="status">
      <p className="text-[13px] font-bold text-app-charcoal">{result.emailSent ? `Invitation emailed to ${result.email}` : `Invitation ready for ${result.email}`}</p>
      <p className="mt-1 text-[12px] text-app-muted">
        {result.emailSent
          ? "They will get an email with the link (ask them to check spam). "
          : "We couldn't send the email from here, so share the link yourself. "}
        The link works once, only for this address, until {new Date(result.expiresAt).toLocaleDateString("en-IN", { dateStyle: "medium" })}.
      </p>
      <input readOnly value={result.url} onFocus={(e) => e.currentTarget.select()} className="o-input mt-3 font-lp-mono !text-[12px]" aria-label="Invitation link" />
      <div className="mt-3 flex flex-wrap gap-2">
        <CopyButton text={result.url} label="Copy link" className="o-btn" />
        <a className="o-btn-ghost" href={`mailto:${encodeURIComponent(result.email)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(message)}`}>
          <Mail size={14} aria-hidden="true" /> Email it
        </a>
        <a className="o-btn-ghost" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(message)}`}>
          <MessageCircle size={14} aria-hidden="true" /> WhatsApp
        </a>
        <button type="button" className="o-btn-ghost" onClick={onDone}>
          Done
        </button>
      </div>
    </div>
  );
}

export function InviteStaffForm({ grantable, institutionName, canGrantAdmin }: { grantable: OrgPermissionKey[]; institutionName: string; canGrantAdmin: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<string>("faculty");
  const [perms, setPerms] = useState<OrgPermissionKey[]>(defaultsFor("faculty").filter((p) => grantable.includes(p)));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);
  const roles = INVITABLE_ROLES.filter((r) => kindOf(r.role) !== "admin" || canGrantAdmin);

  function changeRole(next: string) {
    setRole(next);
    setPerms(defaultsFor(next).filter((p) => grantable.includes(p)));
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const isDefault = sameSet(perms, defaultsFor(role));
    const r = await post("/api/org/invitations", { email, role, permissions: kindOf(role) === "admin" || isDefault ? null : perms });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Something went wrong.");
    setResult(resultFrom(r, role));
    setEmail("");
    router.refresh();
  }

  if (result) return <InviteShare result={result} institutionName={institutionName} onDone={() => setResult(null)} />;

  return (
    <form onSubmit={submit} className="flex flex-col gap-4" noValidate>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <label className="block text-[11.5px] font-bold text-app-muted">
          Work email *
          <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@college.edu" autoComplete="off" className="o-input mt-1.5" />
        </label>
        <label className="block text-[11.5px] font-bold text-app-muted">
          Role *
          <select value={role} onChange={(e) => changeRole(e.target.value)} className="o-input mt-1.5">
            {roles.map((r) => (
              <option key={r.role} value={r.role}>
                {r.label}
              </option>
            ))}
          </select>
        </label>
      </div>
      <PermissionPicker role={role} value={perms} onChange={setPerms} grantable={grantable} />
      {error && (
        <p role="alert" className="text-[12.5px] text-app-rose">
          {error}
        </p>
      )}
      <div>
        <button type="submit" className="o-btn" disabled={busy || !email.trim()}>
          {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Create invitation
        </button>
      </div>
    </form>
  );
}

export function MemberActions({
  membershipId,
  name,
  role,
  permissions,
  canEdit,
  canRemove,
  grantable,
  canGrantAdmin,
}: {
  membershipId: string;
  name: string;
  role: string;
  permissions: OrgPermissionKey[];
  canEdit: boolean;
  canRemove: boolean;
  grantable: OrgPermissionKey[];
  canGrantAdmin: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [newRole, setNewRole] = useState(role);
  const [value, setValue] = useState<OrgPermissionKey[]>(permissions);
  const roles = INVITABLE_ROLES.filter((r) => kindOf(r.role) !== "admin" || canGrantAdmin);
  function changeRole(next: string) {
    setNewRole(next);
    setValue(defaultsFor(next).filter((p) => grantable.includes(p)));
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    const isDefault = sameSet(value, [...effectivePermissions(newRole, null)]);
    const permissionsToSave = isDefault ? null : value;
    // a role change goes through its own route (it also moves the profile's role); otherwise only the access changes
    const r =
      newRole !== role
        ? await post("/api/org/team/role", { membershipId, role: newRole, permissions: permissionsToSave })
        : await post("/api/org/team/permissions", { membershipId, permissions: permissionsToSave });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Something went wrong.");
    setEditing(false);
    router.refresh();
  }
  async function remove() {
    if (!window.confirm(`Remove ${name}'s access? They will no longer be able to open the workspace.`)) return;
    setBusy(true);
    const r = await post("/api/org/team/remove", { membershipId });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Something went wrong.");
    router.refresh();
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canEdit && (
        <button type="button" className="o-btn-ghost" onClick={() => { setNewRole(role); setValue(permissions); setEditing(true); }}>
          Edit
        </button>
      )}
      {canRemove && (
        <button type="button" className="o-btn-danger" onClick={remove} disabled={busy}>
          Remove
        </button>
      )}
      {error && !editing && (
        <span role="alert" className="text-[11.5px] text-app-rose">
          {error}
        </span>
      )}
      {editing && (
        <div className="fixed inset-0 z-30 grid place-items-center overflow-y-auto bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={`Edit access for ${name}`}>
          <div className="o-card my-8 w-full max-w-xl !bg-[var(--o-pop,#14110c)] p-5">
            <h3 className="text-[15px] font-extrabold text-app-charcoal">Edit {name}</h3>
            <label className="mt-4 block text-[11.5px] font-bold text-app-muted">
              Role
              <select value={newRole} onChange={(e) => changeRole(e.target.value)} className="o-input mt-1.5" disabled={busy}>
                {roles.map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.label}
                  </option>
                ))}
                {!roles.some((r) => r.role === role) && <option value={role}>{role}</option>}
              </select>
            </label>
            <div className="mt-4">
              <PermissionPicker role={newRole} value={value} onChange={setValue} grantable={grantable} />
            </div>
            {error && (
              <p role="alert" className="mt-3 text-[12.5px] text-app-rose">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="o-btn-ghost" onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="o-btn" onClick={save} disabled={busy}>
                {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Save changes
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function InvitationActions({
  id,
  email,
  role,
  permissions,
  institutionName,
  grantable,
  canGrantAdmin,
}: {
  id: string;
  email: string;
  role: string;
  permissions: string[] | null;
  institutionName: string;
  grantable: OrgPermissionKey[];
  canGrantAdmin: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [editRole, setEditRole] = useState(role);
  const [editPerms, setEditPerms] = useState<OrgPermissionKey[]>([]);
  const roles = INVITABLE_ROLES.filter((r) => kindOf(r.role) !== "admin" || canGrantAdmin);
  function startEdit() {
    setEditRole(role);
    setEditPerms((permissions ?? defaultsFor(role)).filter((p): p is OrgPermissionKey => grantable.includes(p as OrgPermissionKey)));
    setError(null);
    setEditing(true);
  }
  function changeEditRole(next: string) {
    setEditRole(next);
    setEditPerms(defaultsFor(next).filter((p) => grantable.includes(p)));
  }
  async function saveEdit() {
    setBusy(true);
    setError(null);
    const isDefault = sameSet(editPerms, defaultsFor(editRole));
    // saving replaces the old invitation with a fresh one for the same address and emails it again
    const r = await post("/api/org/invitations", { email, role: editRole, permissions: kindOf(editRole) === "admin" || isDefault ? null : editPerms });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Something went wrong.");
    setEditing(false);
    setResult(resultFrom(r, editRole));
    router.refresh();
  }
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<InviteResult | null>(null);

  async function revoke() {
    if (!window.confirm(`Cancel the invitation for ${email}?`)) return;
    setBusy(true);
    const r = await post("/api/org/invitations/revoke", { invitationId: id });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Something went wrong.");
    router.refresh();
  }
  async function resend() {
    setBusy(true);
    setError(null);
    // a resend issues a fresh link (the old one stops working); keep the permissions it was originally invited with
    const r = await post("/api/org/invitations", { email, role, permissions });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Something went wrong.");
    setResult(resultFrom(r, role));
    router.refresh();
  }

  if (result) return <div className="mt-3 w-full"><InviteShare result={result} institutionName={institutionName} onDone={() => setResult(null)} /></div>;
  return (
    <div className="flex flex-wrap items-center gap-2">
      <button type="button" className="o-btn-ghost" onClick={startEdit} disabled={busy}>
        Edit
      </button>
      <button type="button" className="o-btn-ghost" onClick={resend} disabled={busy}>
        Resend email
      </button>
      <button type="button" className="o-btn-danger" onClick={revoke} disabled={busy}>
        Cancel invite
      </button>
      {error && (
        <span role="alert" className="text-[11.5px] text-app-rose">
          {error}
        </span>
      )}
      {editing && (
        <div className="fixed inset-0 z-30 grid place-items-center overflow-y-auto bg-black/60 p-4" role="dialog" aria-modal="true" aria-label={`Edit invitation for ${email}`}>
          <div className="o-card my-8 w-full max-w-xl !bg-[var(--o-pop,#14110c)] p-5">
            <h3 className="text-[15px] font-extrabold text-app-charcoal">Edit invitation for {email}</h3>
            <p className="mt-1 text-[12px] text-app-muted">Saving cancels the old link and emails a new one.</p>
            <label className="mt-4 block text-[11.5px] font-bold text-app-muted">
              Role
              <select value={editRole} onChange={(e) => changeEditRole(e.target.value)} className="o-input mt-1.5" disabled={busy}>
                {roles.map((r) => (
                  <option key={r.role} value={r.role}>
                    {r.label}
                  </option>
                ))}
              </select>
            </label>
            <div className="mt-4">
              <PermissionPicker role={editRole} value={editPerms} onChange={setEditPerms} grantable={grantable} />
            </div>
            {error && (
              <p role="alert" className="mt-3 text-[12.5px] text-app-rose">
                {error}
              </p>
            )}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" className="o-btn-ghost" onClick={() => setEditing(false)} disabled={busy}>
                Cancel
              </button>
              <button type="button" className="o-btn" onClick={saveEdit} disabled={busy}>
                {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Save and resend
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function JoinLinkActions({ id, url, active, collegeName }: { id: string; url: string; active: boolean; collegeName: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const message = `Join ${collegeName} on Capabilio — build a verified profile of what you can do. Sign up here: ${url}`;
  async function toggle() {
    setBusy(true);
    setError(null);
    const r = await post("/api/org/join-links/toggle", { linkId: id, active: !active });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Something went wrong.");
    router.refresh();
  }
  return (
    <div className="flex flex-wrap items-center gap-2">
      {active && <CopyButton text={url} label="Copy link" className="o-btn" />}
      {active && (
        <a className="o-btn-ghost" target="_blank" rel="noopener noreferrer" href={`https://wa.me/?text=${encodeURIComponent(message)}`}>
          <MessageCircle size={14} aria-hidden="true" /> WhatsApp
        </a>
      )}
      <button type="button" className={active ? "o-btn-danger" : "o-btn-ghost"} onClick={toggle} disabled={busy}>
        {active ? "Turn off" : "Turn on"}
      </button>
      {error && (
        <span role="alert" className="text-[11.5px] text-app-rose">
          {error}
        </span>
      )}
    </div>
  );
}
