"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Flag, GraduationCap, Hash, Loader2, UserMinus, Users } from "lucide-react";
import type { CommunityMember, CommunitySummary } from "@/lib/pulse/communities";
import { canRemoveMember } from "@/lib/pulse/community-rules";
import { Avatar } from "./Avatar";
import { MentorBadge } from "./MentorBadge";
import { ReportDialog } from "./ReportDialog";

const KIND_ICON = { college: Building2, branch: GraduationCap, interest: Hash } as const;
const KIND_LABEL = { college: "College community", branch: "Branch community", interest: "Interest community" } as const;

function Members({ slug, role }: { slug: string; role: CommunitySummary["role"] }) {
  const router = useRouter();
  const [members, setMembers] = useState<CommunityMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let live = true;
    fetch(`/api/pulse/communities/${slug}/members`)
      .then((r) => (r.ok ? (r.json() as Promise<{ members: CommunityMember[] }>) : Promise.reject(new Error("bad"))))
      .then((d) => live && setMembers(d.members))
      .catch(() => live && setError("Couldn't load members."));
    return () => {
      live = false;
    };
  }, [slug]);

  async function remove(userId: string) {
    setError(null);
    const res = await fetch(`/api/pulse/communities/${slug}/members/${userId}`, { method: "DELETE" });
    if (!res.ok) return setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't remove them.");
    setMembers((m) => (m ?? []).filter((x) => x.id !== userId));
    router.refresh();
  }

  if (members === null && !error) return <div className="h-24 animate-pulse rounded-2xl bg-app-background" />;
  return (
    <section aria-label="Members" className="rounded-2xl border border-app-border bg-white p-5">
      <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Members</h2>
      {error && <p role="alert" className="mt-2 font-lp-body text-[12px] text-app-rose">{error}</p>}
      <ul className="mt-3 flex flex-col gap-3">
        {(members ?? []).map((m) => (
          <li key={m.id} className="flex items-center gap-2.5">
            <Avatar person={m} size="sm" />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5"><span className="truncate font-lp-body text-[13px] font-semibold text-app-charcoal">{m.name ?? "Capabilio member"}</span>{m.isMentor && <MentorBadge />}</span>
              <span className="block truncate font-lp-body text-[11.5px] text-app-muted">{m.communityRole === "member" ? (m.headline ?? "") : m.communityRole === "owner" ? "Owner" : "Moderator"}</span>
            </span>
            {canRemoveMember(role, m.communityRole) && <button type="button" onClick={() => remove(m.id)} aria-label={`Remove ${m.name ?? "member"}`} className="rounded-full p-1.5 text-app-muted hover:bg-app-background hover:text-app-rose"><UserMinus size={14} /></button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Top of a community page: what it is, join or leave, report, and (for interest communities) who is in it. */
export function CommunityHeader({ community }: { community: CommunitySummary }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const Icon = KIND_ICON[community.kind];
  const joinable = community.kind === "interest";

  async function toggle() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pulse/communities/${community.slug}/join`, { method: community.isMember ? "DELETE" : "POST" });
      if (!res.ok) return setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't update.");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl border border-app-border bg-white p-6">
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-app-orange-container text-app-orange"><Icon size={24} aria-hidden="true" /></span>
          <div className="min-w-0 flex-1">
            <h1 className="font-lp-display text-[22px] font-semibold text-app-charcoal">{community.name}</h1>
            <p className="mt-0.5 flex items-center gap-1.5 font-lp-body text-[12.5px] text-app-muted"><Users size={12} aria-hidden="true" /> {KIND_LABEL[community.kind]} · {community.memberCount} {community.memberCount === 1 ? "member" : "members"}</p>
            {community.description && <p className="mt-3 max-w-xl font-lp-body text-[13.5px] leading-relaxed text-app-charcoal">{community.description}</p>}
            {!joinable && <p className="mt-3 font-lp-body text-[12px] text-app-muted">You&apos;re in this community through your college profile.</p>}
          </div>
          <div className="flex items-center gap-2">
            {joinable && community.role !== "owner" && (
              <button type="button" onClick={toggle} disabled={busy} className={community.isMember ? "flex items-center gap-2 rounded-full border border-app-border bg-white px-5 py-2 font-lp-body text-[13px] font-semibold text-app-charcoal hover:bg-app-background" : "flex items-center gap-2 rounded-full bg-app-charcoal px-5 py-2 font-lp-body text-[13px] font-semibold text-white"}>
                {busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} {community.isMember ? "Joined" : "Join"}
              </button>
            )}
            <button type="button" onClick={() => setReporting(true)} aria-label="Report this community" className="rounded-full border border-app-border bg-white p-2 text-app-muted hover:text-app-charcoal"><Flag size={15} /></button>
          </div>
        </div>
        {error && <p role="alert" className="mt-3 font-lp-body text-[12px] text-app-rose">{error}</p>}
      </section>
      {joinable && <Members slug={community.slug} role={community.role} />}
      {reporting && <ReportDialog targetType="community" targetId={community.id} onClose={() => setReporting(false)} />}
    </div>
  );
}
