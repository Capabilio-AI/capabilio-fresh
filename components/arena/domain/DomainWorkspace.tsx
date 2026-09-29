"use client";

import { useCallback, useEffect, useState } from "react";
import { ArrowRight, Clock, Database, Loader2, PartyPopper } from "lucide-react";
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
        <article className="overflow-hidden rounded-2xl border border-app-border bg-white">
          <div className="flex flex-wrap items-center gap-3 border-b border-app-border bg-app-blue-container px-5 py-3">
            <Database size={15} className="text-app-blue" />
            <span className="font-lp-mono text-[12px] font-semibold text-app-blue">{ticketCode(data.ticket.sequence)}</span>
            <span className="font-lp-mono text-[11.5px] text-app-charcoal/70">Today&apos;s ticket · open until you close it</span>
            <span className="ml-auto font-lp-mono text-[12px] font-semibold text-app-charcoal">+{pointsForDifficulty(data.ticket.difficulty)} pts</span>
          </div>
          <div className="p-6">
            <p className="font-lp-body text-[12.5px] text-app-muted">
              From {data.ticket.requester} · {data.ticket.category} · est. {data.ticket.time_limit_minutes} min
            </p>
            <h3 className="mt-1.5 font-lp-display text-[20px] font-bold leading-snug text-app-charcoal">{data.ticket.title}</h3>
            <p className="mt-2 line-clamp-2 font-lp-body text-[13.5px] leading-relaxed text-app-charcoal/75">{data.ticket.scenario}</p>
            <button
              type="button"
              onClick={() => setOpen(true)}
              className="mt-5 flex items-center gap-1.5 rounded-lg bg-app-charcoal px-5 py-2.5 font-lp-body text-[13.5px] font-semibold text-white"
            >
              Open workstation
              <ArrowRight size={15} />
            </button>
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
