"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { Check, Search, Sparkles } from "lucide-react";
import type { ClarifyOption, ResolveChoice, ResolveOutcome, RoleCandidate, RoleOption } from "@/lib/assess/roles";
import { filterRoles } from "@/lib/assess/role-filter";
import { ApiError, NetworkError, assessApi } from "@/components/assess/api";

export interface PickedRole { careerId: string; name: string; typed: string }

type View =
  | { kind: "idle" }
  | { kind: "resolving"; slow: boolean }
  | { kind: "candidates"; typed: string; fresh: boolean; roles: RoleCandidate[] }
  | { kind: "clarify"; typed: string; message: string; options: ClarifyOption[] }
  | { kind: "message"; text: string };

const CONNECTION = "We couldn't reach the server. Check your connection and try again.";
const SLOW_AFTER_MS = 2500;
const MAX_SKILLS_SHOWN = 5;
const MAX_SUGGESTIONS = 6;

/**
 * Type the role in your own words, the way sign-up asks for it. The words are matched to a role we already have, or the student is asked which job
 * they mean, or a skill profile is built for a new title (once, for everyone after). Nothing is saved here: the chosen role goes to `onPick`.
 * `excluded` maps a career id to why it can't be picked (their current role, their Plan B), so it is shown but not selectable.
 */
export function RoleKeywordPicker({ onPick, picked, excluded = {}, disabled = false }: { onPick: (role: PickedRole | null) => void; picked: PickedRole | null; excluded?: Record<string, string>; disabled?: boolean }) {
  const id = useId();
  const [text, setText] = useState("");
  const [view, setView] = useState<View>({ kind: "idle" });
  const [options, setOptions] = useState<RoleOption[]>([]);

  // the role list loads once; suggestions then filter locally with no request per keystroke
  useEffect(() => {
    let live = true;
    fetch("/api/assess/role/options").then((r) => r.json()).then((d: { roles?: RoleOption[] }) => { if (live && d.roles) setOptions(d.roles); }).catch(() => undefined);
    return () => { live = false; };
  }, []);
  const typedNow = text.trim();
  const suggestions = useMemo(() => (typedNow ? filterRoles(options, typedNow).slice(0, MAX_SUGGESTIONS).map((h) => h.role) : []), [options, typedNow]);

  const resolve = async (typed: string, choice?: ResolveChoice) => {
    onPick(null);
    setView({ kind: "resolving", slow: false });
    const slow = setTimeout(() => setView((v) => (v.kind === "resolving" ? { kind: "resolving", slow: true } : v)), SLOW_AFTER_MS);
    try {
      const out: ResolveOutcome = await assessApi.resolveRole(typed, choice);
      if (out.status === "REJECTED" || out.status === "UNAVAILABLE") setView({ kind: "message", text: out.message });
      else if (out.status === "CLARIFY") setView({ kind: "clarify", typed, message: out.message, options: out.options });
      else setView({ kind: "candidates", typed, fresh: out.status === "GENERATED", roles: [out.primary, ...out.alternatives] });
    } catch (e) {
      setView({ kind: "message", text: e instanceof NetworkError ? CONNECTION : e instanceof ApiError ? e.message : "Something went wrong. Please try again." });
    } finally {
      clearTimeout(slow);
    }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const typed = text.trim();
    if (typed.length >= 2) void resolve(typed);
  };

  const busy = view.kind === "resolving";
  return (
    <div>
      <form onSubmit={submit} className="flex gap-2">
        <label htmlFor={`${id}-role`} className="sr-only">Type the role</label>
        <div className="relative min-w-0 flex-1">
          <Search size={16} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-app-muted" />
          <input id={`${id}-role`} value={text} onChange={(e) => { setText(e.target.value); if (view.kind !== "resolving") setView({ kind: "idle" }); }} maxLength={160} autoComplete="off" disabled={disabled || busy} placeholder="Type a role, e.g. data scientist, devops, game developer" className="min-h-11 w-full rounded-xl border border-app-border bg-app-card pl-10 pr-3 font-lp-body text-[14px] focus-visible:outline focus-visible:outline-[3px] focus-visible:outline-app-orange" />
        </div>
        <button type="submit" disabled={disabled || busy || text.trim().length < 2} className="min-h-11 shrink-0 rounded-xl bg-app-charcoal px-4 font-lp-body text-[13px] font-semibold text-white transition-transform active:scale-[0.98] disabled:opacity-45">{busy ? "Matching" : "Find role"}</button>
      </form>

      {suggestions.length > 0 && view.kind === "idle" && (
        <div className="mt-3">
          <p className="mb-2 font-lp-body text-[12px] font-semibold text-app-muted">Roles matching “{typedNow}”</p>
          <ul className="grid gap-2">
            {suggestions.map((r) => <Row key={r.careerId} role={r} typed={typedNow} picked={picked} excluded={excluded} disabled={disabled} onPick={onPick} />)}
          </ul>
          <button type="button" onClick={() => void resolve(typedNow)} disabled={disabled || busy} className="mt-2 font-lp-body text-[12.5px] font-semibold text-app-muted underline">Not listed? Use “{typedNow}” as a new role</button>
        </div>
      )}

      <div role="status" aria-live="polite" className="mt-3">
        {view.kind === "resolving" && <p className="font-lp-body text-[13px] text-app-muted">{view.slow ? "Building a skill profile for this new role. It takes a few seconds." : "Matching your words to a role…"}</p>}
        {view.kind === "message" && <p className="rounded-xl bg-app-background px-3.5 py-2.5 font-lp-body text-[13px] text-app-charcoal">{view.text}</p>}
        {view.kind === "candidates" && (
          <div>
            {view.fresh && <p className="mb-2 inline-flex items-center gap-1.5 rounded-full bg-app-orange-container px-2.5 py-1 font-lp-body text-[12px] font-semibold text-app-orange"><Sparkles size={12} aria-hidden /> New skill profile built for you</p>}
            <ul className="grid gap-2">
              {view.roles.map((r, i) => <Row key={r.careerId} role={r} best={i === 0} typed={view.typed} picked={picked} excluded={excluded} disabled={disabled} onPick={onPick} />)}
            </ul>
          </div>
        )}
        {view.kind === "clarify" && (
          <div>
            <p className="mb-2 font-lp-body text-[13.5px] font-semibold">{view.message}</p>
            <ul className="grid gap-2">
              {view.options.map((o, i) => {
                const title = o.kind === "existing" ? o.candidate.name : o.title;
                const body = o.kind === "existing" ? `An existing role with ${o.candidate.skills.length} skills.` : o.kind === "specialization" ? o.description : "Something else: we'll build a skill profile for exactly this title.";
                const choice: ResolveChoice = o.kind === "existing" ? { kind: "existing", careerId: o.candidate.careerId } : o.kind === "specialization" ? { kind: "specialization", title: o.title, parent: o.parent, industry: o.industry, domain: o.domain } : { kind: "as_typed", title: o.title, industry: o.industry, domain: o.domain };
                return (
                  <li key={`${o.kind}-${title}-${i}`}>
                    <button type="button" onClick={() => void resolve(view.typed, choice)} className="w-full rounded-xl border border-app-border bg-app-card p-3.5 text-left transition-colors hover:border-app-charcoal/40">
                      <span className="block font-lp-display text-[15px] font-semibold">{o.kind === "as_typed" ? `Use “${title}” exactly` : title}</span>
                      <span className="mt-0.5 block font-lp-body text-[12.5px] leading-snug text-app-muted">{body}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </div>
  );
}

function Row({ role, best = false, typed, picked, excluded, disabled, onPick }: { role: RoleCandidate; best?: boolean; typed: string; picked: PickedRole | null; excluded: Record<string, string>; disabled: boolean; onPick: (role: PickedRole | null) => void }) {
  const blocked = excluded[role.careerId];
  const on = picked?.careerId === role.careerId;
  return (
    <li>
      <button type="button" disabled={!!blocked || disabled} aria-pressed={on} onClick={() => onPick({ careerId: role.careerId, name: role.name, typed })} className={`flex w-full items-start gap-3 rounded-xl border p-3.5 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-55 ${on ? "border-app-orange bg-app-orange-container/30 ring-1 ring-app-orange" : "border-app-border bg-app-card hover:border-app-charcoal/40"}`}>
        <span className="min-w-0 flex-1">
          <span className="block font-lp-display text-[15px] font-semibold">{role.name}{best && !blocked && <span className="ml-2 font-lp-body text-[11.5px] font-medium text-app-muted">Best match</span>}</span>
          <span className="mt-0.5 block font-lp-body text-[12.5px] leading-snug text-app-muted">{blocked ?? role.skills.slice(0, MAX_SKILLS_SHOWN).map((s) => s.name).join(", ")}</span>
        </span>
        <span aria-hidden className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border ${on ? "border-app-orange bg-app-orange" : "border-app-border"}`}><Check size={12} strokeWidth={3.5} className={on ? "text-white" : "opacity-0"} /></span>
      </button>
    </li>
  );
}
