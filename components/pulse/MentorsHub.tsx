"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Briefcase, Clock, Loader2, MessageCircle, Search } from "lucide-react";
import clsx from "clsx";
import type { MentorCard, MyMentorProfile } from "@/lib/pulse/mentors";
import type { AvatarPerson } from "./Avatar";
import { Avatar } from "./Avatar";
import { FollowButton } from "./FollowButton";
import { MentorApplyForm } from "./MentorApplyForm";
import { MentorBadge } from "./MentorBadge";
import { PulseFeed } from "./PulseFeed";

type Section = "directory" | "posts";
interface Directory {
  mentors: MentorCard[];
  tags: string[];
  mine: MyMentorProfile | null;
}

const STATUS_COPY: Record<string, string> = {
  pending: "Your application is with the Capabilio team. We'll list you once it's approved.",
  approved: "You're an approved mentor. Students can find and message you.",
  rejected: "Your application wasn't approved.",
  suspended: "Your mentor listing is paused by the Capabilio team.",
};

function MentorTile({ m }: { m: MentorCard }) {
  return (
    <li className="flex flex-col gap-3 rounded-2xl border border-[var(--m-rule)] bg-white p-5">
      <div className="flex items-start gap-3">
        <Link href={`/pulse/u/${m.id}`}><Avatar person={m} size="lg" /></Link>
        <div className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2"><Link href={`/pulse/u/${m.id}`} className="font-lp-body text-[15px] font-semibold text-[var(--m-ink)] hover:underline">{m.name}</Link><MentorBadge /></span>
          <p className="mt-0.5 font-lp-body text-[12.5px] text-app-muted">{m.mentorHeadline}</p>
          {(m.company || m.roleTitle) && <p className="mt-1 flex items-center gap-1.5 font-lp-body text-[12px] text-app-muted"><Briefcase size={11} aria-hidden="true" /> {[m.roleTitle, m.company].filter(Boolean).join(" at ")}{m.yearsExperience != null ? ` · ${m.yearsExperience}y` : ""}</p>}
        </div>
      </div>
      <p className="line-clamp-3 font-lp-body text-[13px] leading-relaxed text-[var(--m-ink)]">{m.bio}</p>
      <ul className="flex flex-wrap gap-1.5" aria-label="Expertise">{m.expertise.map((t) => <li key={t} className="rounded-full border border-[var(--m-rule)] px-2.5 py-0.5 font-lp-body text-[11.5px] text-app-muted">{t}</li>)}</ul>
      {m.availability && <p className="flex items-center gap-1.5 font-lp-body text-[12px] text-app-muted"><Clock size={11} aria-hidden="true" /> {m.availability}</p>}
      <div className="mt-auto flex items-center gap-2 border-t border-[var(--m-rule)] pt-3">
        {m.isAccepting ? (
          <Link href={`/pulse/messages?to=${m.id}`} className="flex items-center gap-1.5 rounded-full bg-app-orange px-4 py-2 font-lp-body text-[12.5px] font-semibold text-white"><MessageCircle size={13} aria-hidden="true" /> Message</Link>
        ) : (
          <span className="rounded-full bg-app-background px-3 py-1.5 font-lp-body text-[11.5px] text-app-muted">Not taking new requests</span>
        )}
        <span className="ml-auto"><FollowButton userId={m.id} initialFollowing={m.following} compact /></span>
      </div>
    </li>
  );
}

/** The Mentors tab: browse approved mentors, read their posts, and apply to become one. */
export function MentorsHub({ viewer }: { viewer: { id: string } & AvatarPerson }) {
  const [section, setSection] = useState<Section>("directory");
  const [q, setQ] = useState("");
  const [tag, setTag] = useState<string | null>(null);
  const [data, setData] = useState<Directory | null>(null);
  const [failed, setFailed] = useState(false);
  const [tick, setTick] = useState(0);
  const [applying, setApplying] = useState(false);

  useEffect(() => {
    let live = true;
    const params = new URLSearchParams();
    if (q.trim()) params.set("q", q.trim());
    if (tag) params.set("tag", tag);
    const timer = setTimeout(() => {
      fetch(`/api/pulse/mentors?${params}`)
        .then((r) => (r.ok ? (r.json() as Promise<Directory>) : Promise.reject(new Error("bad"))))
        .then((d) => {
          if (!live) return;
          setData(d);
          setFailed(false);
        })
        .catch(() => live && setFailed(true));
    }, 250);
    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [q, tag, tick]);

  const mine = data?.mine ?? null;

  return (
    <div className="flex flex-col gap-5">
      <div className="inline-flex self-start rounded-xl border border-[var(--m-rule)] bg-white p-1" role="tablist" aria-label="Mentors">
        {([["directory", "Find a mentor"], ["posts", "Mentor posts"]] as const).map(([key, label]) => (
          <button key={key} type="button" role="tab" aria-selected={section === key} onClick={() => setSection(key)} className={clsx("rounded-lg px-4 py-2 font-lp-body text-[13px] font-medium", section === key ? "bg-app-charcoal text-white" : "text-app-muted hover:text-[var(--m-ink)]")}>{label}</button>
        ))}
      </div>

      {section === "posts" ? (
        <PulseFeed view={{ mode: "mentors" }} viewer={viewer} />
      ) : (
        <>
          <section aria-label="Become a mentor" className="rounded-2xl border border-[var(--m-rule)] bg-white p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="font-lp-display text-[16px] font-bold text-[var(--m-ink)]">{mine ? "Your mentor profile" : "Mentor students on Capabilio"}</h2>
                <p className="mt-1 max-w-lg font-lp-body text-[12.5px] text-app-muted">{mine ? STATUS_COPY[mine.status] : "Share your experience with students who are working towards your kind of role. Capabilio reviews every application before a mentor badge or listing appears."}</p>
                {mine?.reviewNote && mine.status !== "approved" && <p className="mt-1 font-lp-body text-[12.5px] text-[var(--m-ink)]">Note from the team: {mine.reviewNote}</p>}
              </div>
              {(!mine || mine.status === "approved" || mine.status === "pending") && <button type="button" onClick={() => setApplying((a) => !a)} className="rounded-full border border-[var(--m-rule)] px-4 py-2 font-lp-body text-[13px] font-semibold text-[var(--m-ink)] hover:bg-app-background">{applying ? "Close" : mine ? "Edit profile" : "Apply"}</button>}
              {mine?.status === "approved" && (
                <label className="flex items-center gap-2 font-lp-body text-[12.5px] text-[var(--m-ink)]">
                  <input type="checkbox" checked={mine.isAccepting} onChange={async (e) => { await fetch("/api/pulse/mentors/me", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isAccepting: e.target.checked }) }); setTick((t) => t + 1); }} /> Taking new requests
                </label>
              )}
            </div>
            {applying && <div className="mt-4 border-t border-[var(--m-rule)] pt-4"><MentorApplyForm mine={mine} onSaved={() => { setApplying(false); setTick((t) => t + 1); }} /></div>}
          </section>

          <div className="flex flex-col gap-3">
            <label className="flex items-center gap-2 rounded-full border border-[var(--m-rule)] bg-white px-4 focus-within:border-app-orange focus-within:ring-2 focus-within:ring-app-orange/20">
              <Search size={15} className="text-app-muted" aria-hidden="true" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search mentors by name, company or skill…" aria-label="Search mentors" className="w-full bg-transparent py-2.5 font-lp-body text-[13.5px] focus:outline-none" />
            </label>
            {data && data.tags.length > 0 && (
              <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by expertise">
                {data.tags.map((t) => <button key={t} type="button" aria-pressed={tag === t} onClick={() => setTag(tag === t ? null : t)} className={clsx("rounded-full border px-3 py-1 font-lp-body text-[12px]", tag === t ? "border-app-orange bg-app-orange-container text-app-orange" : "border-[var(--m-rule)] text-app-muted hover:text-[var(--m-ink)]")}>{t}</button>)}
              </div>
            )}
          </div>

          {failed ? (
            <p role="alert" className="rounded-2xl border border-[var(--m-rule)] bg-white px-6 py-10 text-center font-lp-body text-[13px] text-app-rose">Couldn&apos;t load mentors. Try again in a moment.</p>
          ) : !data ? (
            <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-app-orange" aria-label="Loading" /></div>
          ) : data.mentors.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--m-rule)] bg-white px-6 py-12 text-center">
              <p className="font-lp-body text-[14px] font-semibold text-[var(--m-ink)]">{q || tag ? "No mentors match" : "No mentors yet"}</p>
              <p className="mx-auto mt-1 max-w-sm font-lp-body text-[13px] text-app-muted">{q || tag ? "Try fewer words or clear the filter." : "Mentors appear here once Capabilio approves them. Know someone great? Ask them to apply."}</p>
            </div>
          ) : (
            <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">{data.mentors.map((m) => <MentorTile key={m.id} m={m} />)}</ul>
          )}
        </>
      )}
    </div>
  );
}
