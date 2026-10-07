"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Ban, Flag, MoreHorizontal } from "lucide-react";
import { ReportDialog } from "./ReportDialog";

/** Report or block another person from their profile. */
export function ProfileMenu({ userId, name }: { userId: string; name: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function block() {
    setOpen(false);
    const res = await fetch(`/api/pulse/block/${userId}`, { method: "POST" });
    if (!res.ok) return setError("Couldn't block. Try again.");
    router.push("/pulse");
    router.refresh();
  }

  return (
    <div className="relative">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-label="More options" aria-expanded={open} className="rounded-full border border-app-border bg-white p-2 text-app-muted hover:text-app-charcoal"><MoreHorizontal size={16} /></button>
      {open && (
        <div className="absolute right-0 z-10 mt-1 w-48 overflow-hidden rounded-xl border border-app-border bg-white py-1 shadow-lg">
          <button type="button" onClick={() => { setOpen(false); setReporting(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-left font-lp-body text-[13px] text-app-charcoal hover:bg-app-background"><Flag size={13} aria-hidden="true" /> Report profile</button>
          <button type="button" onClick={block} className="flex w-full items-center gap-2 px-3 py-2 text-left font-lp-body text-[13px] text-app-rose hover:bg-app-background"><Ban size={13} aria-hidden="true" /> Block {name}</button>
        </div>
      )}
      {error && <p role="alert" className="absolute right-0 mt-1 whitespace-nowrap font-lp-body text-[11px] text-app-rose">{error}</p>}
      {reporting && <ReportDialog targetType="user" targetId={userId} onClose={() => setReporting(false)} />}
    </div>
  );
}
