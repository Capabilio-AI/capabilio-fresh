"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Release an offer: confirm the placement (company, role, package) and attach the company's offer letter.
 * Two server calls — confirm, then upload — so a rejected file never leaves a half-created placement unexplained.
 */
export function OfferForm({ applicationId, company, role }: { applicationId: string; company: string; role: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const data = new FormData(form);
    const file = data.get("letter");
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/org/placements/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          applicationId,
          company: String(data.get("company") ?? "").trim() || undefined,
          roleTitle: String(data.get("roleTitle") ?? "").trim() || undefined,
          ctcLpa: String(data.get("ctcLpa") ?? "").trim() ? Number(data.get("ctcLpa")) : undefined,
          offerDate: String(data.get("offerDate") ?? "").trim() || undefined,
        }),
      });
      const json = (await res.json().catch(() => null)) as { error?: string; placementId?: string } | null;
      if (!res.ok || !json?.placementId) return setMessage({ ok: false, text: json?.error ?? "Something went wrong." });

      if (file instanceof File && file.size > 0) {
        const upload = new FormData();
        upload.append("placementId", json.placementId);
        upload.append("file", file);
        const up = await fetch("/api/org/offers/letter", { method: "POST", body: upload });
        const upJson = (await up.json().catch(() => null)) as { error?: string } | null;
        if (!up.ok) {
          setMessage({ ok: false, text: `Placement confirmed, but the letter wasn't saved: ${upJson?.error ?? "upload failed"}. Try attaching it again.` });
          router.refresh();
          return;
        }
      }
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Connection problem. Please try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="grid grid-cols-1 gap-x-4 gap-y-3 md:grid-cols-2" noValidate>
      <label className="block text-[11.5px] font-bold text-app-muted">
        Company
        <input name="company" defaultValue={company} className="o-input mt-1.5" />
      </label>
      <label className="block text-[11.5px] font-bold text-app-muted">
        Role offered
        <input name="roleTitle" defaultValue={role} className="o-input mt-1.5" />
      </label>
      <label className="block text-[11.5px] font-bold text-app-muted">
        Package (LPA)
        <input name="ctcLpa" type="number" step="0.01" min="0" className="o-input mt-1.5" placeholder="6.5" />
      </label>
      <label className="block text-[11.5px] font-bold text-app-muted">
        Offer date
        <input name="offerDate" type="date" className="o-input mt-1.5" />
      </label>
      <label className="block text-[11.5px] font-bold text-app-muted md:col-span-2">
        Offer letter from the company (PDF or image, optional, private)
        <input name="letter" type="file" accept="application/pdf,image/png,image/jpeg" className="o-input mt-1.5 file:mr-3 file:rounded-lg file:border-0 file:bg-white/10 file:px-3 file:py-1.5 file:text-[12px] file:font-bold file:text-app-charcoal" />
      </label>
      <div className="flex flex-wrap items-center gap-3 md:col-span-2">
        <button type="submit" className="o-btn" disabled={busy}>
          {busy && <Loader2 size={14} className="animate-spin" aria-hidden="true" />} Release offer and confirm placement
        </button>
        {message && (
          <p role={message.ok ? "status" : "alert"} className={`text-[12.5px] ${message.ok ? "text-app-success" : "text-app-rose"}`}>
            {message.text}
          </p>
        )}
      </div>
    </form>
  );
}
