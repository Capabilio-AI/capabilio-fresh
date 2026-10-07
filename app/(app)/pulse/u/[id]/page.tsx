import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock, MessageCircle } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { blockedWith, followingIds, profileCounts } from "@/lib/pulse/graph";
import { loadPeople } from "@/lib/pulse/people";
import { Avatar } from "@/components/pulse/Avatar";
import { FollowButton } from "@/components/pulse/FollowButton";
import { MentorBadge } from "@/components/pulse/MentorBadge";
import { getMyMentorProfile } from "@/lib/pulse/mentors";
import { ProfileMenu } from "@/components/pulse/ProfileMenu";
import { PulseFeed } from "@/components/pulse/PulseFeed";

export const metadata: Metadata = { title: "Profile — Pulse — Capabilio AI" };
const UUID = /^[0-9a-f-]{36}$/i;

export default async function PulseProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  const isMe = id === user.id;

  const [people, blocked, following, counts, { data: flag }] = await Promise.all([
    loadPeople(service, [id]),
    blockedWith(service, user.id),
    followingIds(service, user.id),
    profileCounts(service, id),
    untyped(service).from("profiles").select("pulse_discoverable").eq("id", id).maybeSingle(),
  ]);
  const person = people.get(id);
  if (!person || blocked.has(id)) notFound();
  const follows = following.includes(id);
  const hidden = !isMe && !follows && (flag as { pulse_discoverable: boolean } | null)?.pulse_discoverable === false;
  const name = person.name ?? "Capabilio member";
  const mentor = person.isMentor && !hidden ? await getMyMentorProfile(service, id) : null;

  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/pulse" className="inline-flex items-center gap-1.5 font-lp-body text-[12.5px] text-app-muted hover:text-app-charcoal"><ArrowLeft size={13} aria-hidden="true" /> Pulse</Link>
      <section className="mt-3 rounded-2xl border border-app-border bg-white p-6">
        <div className="flex flex-wrap items-start gap-5">
          <Avatar person={person} size="xl" />
          <div className="min-w-0 flex-1">
            <h1 className="flex flex-wrap items-center gap-2.5 font-lp-display text-[24px] font-semibold text-app-charcoal">{name}{person.isMentor && <MentorBadge />}</h1>
            <p className="mt-1 font-lp-body text-[13px] text-app-muted">{person.headline ?? "Capabilio member"}</p>
            {!hidden && (
              <dl className="mt-4 flex gap-6">
                {([["Posts", counts.posts], ["Followers", counts.followers], ["Following", counts.following]] as const).map(([label, n]) => (
                  <div key={label}><dd className="font-lp-display text-[18px] font-semibold text-app-charcoal">{n}</dd><dt className="font-lp-body text-[11.5px] text-app-muted">{label}</dt></div>
                ))}
              </dl>
            )}
          </div>
          {isMe ? (
            <Link href="/profile" className="rounded-full border border-app-border px-4 py-2 font-lp-body text-[13px] font-semibold text-app-charcoal hover:bg-app-background">Edit profile</Link>
          ) : (
            <div className="flex items-center gap-2"><Link href={`/pulse/messages?to=${id}`} className="flex items-center gap-1.5 rounded-full border border-app-border px-4 py-2 font-lp-body text-[13px] font-semibold text-app-charcoal hover:bg-app-background"><MessageCircle size={14} aria-hidden="true" /> Message</Link><FollowButton userId={id} initialFollowing={follows} /><ProfileMenu userId={id} name={name.split(" ")[0]} /></div>
          )}
        </div>
      </section>

      {mentor && (
        <section aria-label="Mentor profile" className="mt-4 rounded-2xl border border-app-border bg-white p-6">
          <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">{mentor.headline}</h2>
          <p className="mt-2 whitespace-pre-wrap font-lp-body text-[13.5px] leading-relaxed text-app-charcoal">{mentor.bio}</p>
          <ul className="mt-3 flex flex-wrap gap-1.5" aria-label="Expertise">{mentor.expertise.map((t) => <li key={t} className="rounded-full border border-app-border px-2.5 py-0.5 font-lp-body text-[11.5px] text-app-muted">{t}</li>)}</ul>
          {mentor.availability && <p className="mt-3 font-lp-body text-[12.5px] text-app-muted">Availability: {mentor.availability}</p>}
        </section>
      )}

      <div className="mt-5">
        {hidden ? (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-app-border bg-white px-6 py-12 text-center">
            <Lock size={18} className="text-app-muted" aria-hidden="true" />
            <p className="font-lp-body text-[13.5px] font-semibold text-app-charcoal">This profile is private</p>
            <p className="max-w-sm font-lp-body text-[12.5px] text-app-muted">Follow {name.split(" ")[0]} to see their posts and stories.</p>
          </div>
        ) : (
          <PulseFeed view={{ mode: "user", userId: id }} viewer={{ id: user.id, name: null, avatarUrl: null }} />
        )}
      </div>
    </div>
  );
}
