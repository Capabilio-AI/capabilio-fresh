"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import type { RollNumberNotice } from "@/lib/org/roll-number";

function daysLeft(dueAt: string | null): number | null {
  return dueAt ? Math.max(0, Math.ceil((new Date(dueAt).getTime() - Date.now()) / 86_400_000)) : null;
}

export function RollNumberBanner({ notice }: { notice: RollNumberNotice }) {
  const router = useRouter();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState(false);
  const left = daysLeft(notice.dueAt);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    const res = await fetch("/api/profile/roll-number", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rollNumber: value }) });
    const body = (await res.json().catch(() => ({}))) as { error?: string; status?: string };
    setBusy(false);
    if (!res.ok) return setError(body.error ?? "Could not save your roll number.");
    if (body.status === "flagged") setError(`That roll number doesn't match ${notice.collegeName}'s code. Check it and try again.`);
    else setValue("");
    router.refresh(); // re-read the saved state so the message above matches it
  }

  return (
    <div role="alert" className="rounded-xl border border-app-border bg-app-warning-container p-4">
      <p className="font-lp-body text-[13.5px] font-medium text-app-charcoal">
        {notice.kind === "missing"
          ? `Add your ${notice.collegeName} roll number${left !== null ? ` within ${left} day${left === 1 ? "" : "s"}` : ""} or your account will be removed.`
          : `The roll number on your account${notice.rollNumber ? ` (${notice.rollNumber})` : ""} doesn't match ${notice.collegeName}'s code. Correct it${left !== null ? ` within ${left} day${left === 1 ? "" : "s"}` : ""} or your account will be removed.`}
      </p>
      <form onSubmit={submit} className="mt-3 flex flex-wrap items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          required
          maxLength={30}
          placeholder="e.g. 13AJ5A0405"
          aria-label="College roll number"
          className="rounded border border-app-border bg-white px-3 py-2 font-lp-mono text-[13px]"
        />
        <button type="submit" disabled={busy} className="rounded bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-60">
          {busy ? "Saving…" : "Save roll number"}
        </button>
        {error && <span className="font-lp-body text-[12.5px] text-app-charcoal">{error}</span>}
      </form>
    </div>
  );
}
