"use client";

import { useState } from "react";
import { X } from "lucide-react";
import { normalizeTags } from "@/lib/pulse/post-schema";

export const FIELD = "w-full rounded-xl border border-app-border bg-app-background px-3.5 py-2.5 font-lp-body text-[13.5px] text-app-charcoal placeholder:text-app-muted focus:border-app-orange focus:outline-none focus:ring-2 focus:ring-app-orange/20";

export function Labelled({ id, label, hint, children }: { id: string; label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-lp-body text-[12px] font-semibold text-app-charcoal">{label}{hint && <span className="ml-1.5 font-normal text-app-muted">{hint}</span>}</label>
      {children}
    </div>
  );
}

/** Type a tag and press Enter or comma; Backspace on an empty box removes the last one. */
export function TagInput({ id, value, onChange, max, placeholder }: { id: string; value: string[]; onChange: (tags: string[]) => void; max: number; placeholder: string }) {
  const [text, setText] = useState("");
  const add = (raw: string) => {
    const next = normalizeTags([...value, ...raw.split(",")], max);
    onChange(next);
    setText("");
  };
  return (
    <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-app-border bg-app-background px-2.5 py-2 focus-within:border-app-orange focus-within:ring-2 focus-within:ring-app-orange/20">
      {value.map((t) => (
        <span key={t} className="flex items-center gap-1 rounded-full bg-white px-2.5 py-1 font-lp-body text-[12px] text-app-charcoal ring-1 ring-app-border">
          {t}
          <button type="button" onClick={() => onChange(value.filter((x) => x !== t))} aria-label={`Remove ${t}`} className="text-app-muted hover:text-app-charcoal"><X size={11} /></button>
        </span>
      ))}
      {value.length < max && (
        <input
          id={id}
          value={text}
          onChange={(e) => (e.target.value.includes(",") ? add(e.target.value) : setText(e.target.value))}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              if (text.trim()) add(text);
            } else if (e.key === "Backspace" && !text && value.length > 0) onChange(value.slice(0, -1));
          }}
          onBlur={() => text.trim() && add(text)}
          placeholder={value.length === 0 ? placeholder : ""}
          className="min-w-[8rem] flex-1 bg-transparent py-0.5 font-lp-body text-[13px] focus:outline-none"
        />
      )}
    </div>
  );
}

export interface Draft {
  content: string;
  title: string;
  stack: string[];
  repoUrl: string;
  demoUrl: string;
  status: "building" | "shipped";
  tags: string[];
  issuer: string;
  achievedOn: string;
  proofUrl: string;
}
export const EMPTY_DRAFT: Draft = { content: "", title: "", stack: [], repoUrl: "", demoUrl: "", status: "building", tags: [], issuer: "", achievedOn: "", proofUrl: "" };

export type Kind = "post" | "project" | "question" | "achievement";

/** Whether the draft has what that kind of post needs (the server checks the same minimums). */
export function draftReady(kind: Kind, d: Draft): boolean {
  if (kind === "post") return d.content.trim().length >= 1;
  if (kind === "project") return d.title.trim().length >= 3 && d.content.trim().length >= 10;
  if (kind === "question") return d.title.trim().length >= 10;
  return d.title.trim().length >= 3;
}

/** The request body for a draft; empty optional fields are left out. */
export function draftBody(kind: Kind, d: Draft): Record<string, unknown> {
  const opt = (v: string) => (v.trim() ? v.trim() : undefined);
  if (kind === "post") return { kind, content: d.content.trim() };
  if (kind === "project") return { kind, title: d.title.trim(), content: d.content.trim(), stack: d.stack, repoUrl: opt(d.repoUrl), demoUrl: opt(d.demoUrl), status: d.status };
  if (kind === "question") return { kind, title: d.title.trim(), content: d.content.trim(), tags: d.tags };
  return { kind, title: d.title.trim(), content: d.content.trim(), issuer: opt(d.issuer), achievedOn: opt(d.achievedOn), proofUrl: opt(d.proofUrl) };
}
