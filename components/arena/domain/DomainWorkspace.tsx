"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, Clock, Code2, Loader2, PartyPopper, Trophy } from "lucide-react";
import type { SchemaTable } from "@/lib/domain-workstations/urbankart";
import { pointsForDifficulty } from "@/lib/arena-challenges/points";
import { Countdown } from "./Countdown";
import { DataAnalystWorkstation, ticketCode, type ActiveTicket } from "./DataAnalystWorkstation";

type DomainPayload = {
  statedRole: string | null;
  role: { key: string; label: string; company: string; companyBlurb: string };
  schema: SchemaTable[];
  completedCount: number;
  totalCount: number;
} & (
  | { state: "not_started" }
  | ({ state: "active" } & ActiveTicket)
  | { state: "cooldown"; nextAvailableAt: string }
  | { state: "complete" }
);

export function DomainWorkspace() {
  const [data, setData] = useState<DomainPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [open, setOpen] = useState(false);

  const load = useCallback(
    (method: "GET" | "POST" = "GET") =>
      fetch("/api/arena/domain", { method })
        .then(async (res) => ({ ok: res.ok, body: await res.json() }))
        .then(({ ok, body }) => {
          setError(ok ? null : (body.error ?? "Could not load your ticket."));
          if (ok) setData(body);
        })
        .catch(() => setError("Could not reach the server — check your connection.")),
    []
  );

  useEffect(() => {
    load();
  }, [load]);

  async function start() {
    setStarting(true);
    await load("POST");
    setStarting(false);
  }

  if (error) {
    return (
      <div className="rounded-xl border border-app-border bg-white px-6 py-12 text-center">
        <p className="font-lp-body text-[13.5px] text-app-charcoal">{error}</p>
        <button type="button" onClick={() => load()} className="mt-4 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white">
          Try again
        </button>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 size={22} className="animate-spin text-app-muted" />
      </div>
    );
  }

  const progress = (
    <p className="font-lp-mono text-[11.5px] text-app-muted">
      {data.completedCount} of {data.totalCount} tickets closed
    </p>
  );

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="font-lp-display text-[24px] font-bold text-app-charcoal">{data.role.label} Workstation</h2>
          <p className="mt-1 font-lp-body text-[13px] text-app-muted">
            You&apos;re on the analytics team at {data.role.company} ({data.role.companyBlurb}). One ticket a day, the kind of work a fresher analyst actually gets.
          </p>
        </div>
        {data.state !== "not_started" && <div className="hidden shrink-0 sm:block">{progress}</div>}
      </div>

      {data.state === "not_started" && (
        <div className="rounded-2xl border border-app-border bg-white p-6">
          {data.statedRole && (
            <p className="font-lp-body text-[13px] text-app-muted">
              Your target role is <span className="font-semibold text-app-charcoal">{data.statedRole}</span>. A workstation for it is on the way.
            </p>
          )}
          <p className="mt-2 font-lp-body text-[14px] text-app-charcoal">
            The {data.role.label} workstation is live now: real SQL against {data.role.company}&apos;s warehouse, tickets from real-sounding stakeholders, graded on your numbers.
          </p>
          <button
            type="button"
            onClick={start}
            disabled={starting}
            className="mt-5 flex items-center gap-1.5 rounded-lg bg-app-charcoal px-5 py-2.5 font-lp-body text-[13.5px] font-semibold text-white disabled:opacity-60"
          >
            {starting ? <Loader2 size={15} className="animate-spin" /> : <ArrowRight size={15} />}
            Start as a {data.role.label}
          </button>
        </div>
      )}

      {data.state === "active" && (
        <article className="flex min-h-[350px] flex-col gap-6 rounded-3xl border border-[#E0E0E0] bg-white p-6 sm:p-10">
          <div className="flex items-center justify-between gap-3">
            <span className="flex items-center gap-2 font-lp-body text-[15px] font-medium text-[#5F6368]">
              <Code2 size={20} strokeWidth={1.5} />
              Today&apos;s Mission
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-[#F1F3F4] px-3.5 py-1.5 font-lp-body text-[15px] font-semibold text-[#202124]">
              <Trophy size={16} strokeWidth={2.5} className="text-app-orange" />+{pointsForDifficulty(data.ticket.difficulty)} pts
            </span>
          </div>

          <div>
            <h3 className="font-lp-body text-[26px] font-normal leading-tight tracking-[-0.02em] text-[#202124] sm:text-[32px]">{data.ticket.title}</h3>
            <div className="mt-3 flex flex-wrap items-center gap-3 font-lp-body text-[15px] font-medium text-[#5F6368]">
              <span className="rounded-full bg-[#F1F3F4] px-3 py-1 text-[14px] font-semibold text-[#202124]">{data.role.company}</span>
              <span className="text-[#DADCE0]">•</span>
              <span>{data.ticket.category}</span>
              <span className="text-[#DADCE0]">•</span>
              <span>{ticketCode(data.ticket.sequence)}</span>
            </div>
          </div>

          <div className="flex max-w-[90%] flex-col gap-3 font-lp-body text-[16px] leading-[1.6] text-[#3C4043]">
            <p>
              <span className="font-semibold text-[#202124]">{data.ticket.requester?.split("·")[0].trim()}:</span> {data.ticket.scenario}
            </p>
            <p>{data.ticket.objective}</p>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="inline-flex items-center gap-2 rounded-full bg-app-orange px-6 py-3 font-lp-body text-[15px] font-semibold text-white transition-colors hover:bg-[#e64e00]"
            >
              Solve in Workspace
              <ArrowRight size={18} strokeWidth={2} />
            </button>
            <Link
              href="/skillstudio"
              className="inline-flex items-center gap-2 rounded-full border border-[#DADCE0] px-6 py-3 font-lp-body text-[15px] font-semibold text-[#3C4043] transition-colors hover:bg-[#F1F3F4]"
            >
              <BookOpen size={18} strokeWidth={1.5} />
              Learn First
            </Link>
          </div>
        </article>
      )}

      {data.state === "cooldown" && (
        <div className="rounded-2xl border border-app-border bg-white px-6 py-10 text-center">
          <Clock size={26} className="mx-auto text-app-blue" />
          <p className="mt-3 font-lp-body text-[13.5px] text-app-muted">Ticket closed. Your next ticket arrives in</p>
          <p className="mt-1 font-lp-display text-[40px] font-bold text-app-charcoal">
            <Countdown target={data.nextAvailableAt} onDone={load} />
          </p>
          <p className="mt-2 font-lp-body text-[12.5px] text-app-muted">A new ticket unlocks 24 hours after you close the previous one.</p>
        </div>
      )}

      {data.state === "complete" && (
        <div className="rounded-2xl border border-app-border bg-white px-6 py-10 text-center">
          <PartyPopper size={26} className="mx-auto text-app-orange" />
          <p className="mt-3 font-lp-display text-[18px] font-semibold text-app-charcoal">You&apos;ve closed every {data.role.company} ticket.</p>
          <p className="mt-1 font-lp-body text-[13px] text-app-muted">New tickets are added over time — check back soon.</p>
        </div>
      )}

      {data.state !== "not_started" && <div className="mt-3 sm:hidden">{progress}</div>}

      {open && data.state === "active" && (
        <DataAnalystWorkstation
          active={data}
          company={data.role.company}
          schema={data.schema}
          onClose={(ticketClosed) => {
            setOpen(false);
            if (ticketClosed) load();
          }}
        />
      )}
    </div>
  );
}
