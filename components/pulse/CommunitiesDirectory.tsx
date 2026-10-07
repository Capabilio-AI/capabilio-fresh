"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, GraduationCap, Hash, Loader2, Plus, Users, X } from "lucide-react";
import type { CommunitySummary } from "@/lib/pulse/communities";

const KIND_ICON = { college: Building2, branch: GraduationCap, interest: Hash } as const;
const KIND_LABEL = { college: "Your college", branch: "Your branch", interest: "Interest" } as const;

function Card({ c }: { c: CommunitySummary }) {
  const Icon = KIND_ICON[c.kind];
  return (
    <li>
      <Link href={`/pulse/c/${c.slug}`} className="flex h-full flex-col gap-2 rounded-2xl border border-app-border bg-white p-4 transition-colors hover:bg-app-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-orange/40">
        <span className="flex items-center gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-app-orange-container text-app-orange"><Icon size={18} aria-hidden="true" /></span>
          <span className="min-w-0">
            <span className="block truncate font-lp-body text-[14px] font-semibold text-app-charcoal">{c.name}</span>
            <span className="block font-lp-body text-[11.5px] text-app-muted">{KIND_LABEL[c.kind]} · {c.memberCount} {c.memberCount === 1 ? "member" : "members"}</span>
          </span>
        </span>
        {c.description && <span className="line-clamp-2 font-lp-body text-[12.5px] leading-relaxed text-app-muted">{c.description}</span>}
      </Link>
    </li>
  );
}

function CreateDialog({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function create() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/pulse/communities", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: name.trim(), description: description.trim() || undefined }) });
      const json = (await res.json().catch(() => null)) as { slug?: string; error?: string } | null;
      if (!res.ok || !json?.slug) return setError(json?.error ?? "Couldn't create the community.");
      router.push(`/pulse/c/${json.slug}`);
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Start a community">
      <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-lp-display text-[17px] font-semibold text-app-charcoal">Start a community</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-app-muted hover:bg-app-background"><X size={16} /></button>
        </div>
        <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">Pick a topic people will want to talk about. You become its owner and can remove posts and members.</p>
        <label htmlFor="community-name" className="mt-4 block font-lp-body text-[12px] font-medium text-app-charcoal">Name</label>
        <input id="community-name" value={name} onChange={(e) => setName(e.target.value.slice(0, 60))} placeholder="e.g. Embedded Systems" className="mt-1 w-full rounded-lg border border-app-border bg-app-background px-3 py-2 font-lp-body text-[13.5px] focus:border-app-orange focus:outline-none focus:ring-2 focus:ring-app-orange/20" />
        <label htmlFor="community-desc" className="mt-3 block font-lp-body text-[12px] font-medium text-app-charcoal">What is it about? (optional)</label>
        <textarea id="community-desc" value={description} onChange={(e) => setDescription(e.target.value.slice(0, 400))} rows={3} className="mt-1 w-full resize-none rounded-lg border border-app-border bg-app-background px-3 py-2 font-lp-body text-[13.5px] focus:border-app-orange focus:outline-none focus:ring-2 focus:ring-app-orange/20" />
        {error && <p role="alert" className="mt-2 font-lp-body text-[12px] text-app-rose">{error}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 font-lp-body text-[13px] text-app-muted hover:bg-app-background">Cancel</button>
          <button type="button" onClick={create} disabled={busy || name.trim().length < 3} className="flex items-center gap-2 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-50">{busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} Create</button>
        </div>
      </div>
    </div>
  );
}

/** The Communities tab: the ones you belong to, ones to discover, and a way to start your own. */
export function CommunitiesDirectory() {
  const [data, setData] = useState<{ mine: CommunitySummary[]; discover: CommunitySummary[] } | null>(null);
  const [failed, setFailed] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/pulse/communities")
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
      .then((d) => live && setData(d))
      .catch(() => live && setFailed(true));
    return () => {
      live = false;
    };
  }, []);

  if (failed) return <p role="alert" className="rounded-2xl border border-app-border bg-white px-6 py-10 text-center font-lp-body text-[13px] text-app-rose">Couldn&apos;t load communities. Refresh to try again.</p>;
  if (!data) return <div className="flex justify-center py-16"><Loader2 size={20} className="animate-spin text-app-orange" aria-label="Loading" /></div>;

  return (
    <div className="flex flex-col gap-8">
      <section aria-label="Your communities">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-lp-display text-[16px] font-semibold text-app-charcoal">Your communities</h2>
          <button type="button" onClick={() => setCreating(true)} className="flex items-center gap-1.5 rounded-full bg-app-charcoal px-4 py-2 font-lp-body text-[12.5px] font-semibold text-white"><Plus size={13} aria-hidden="true" /> Start one</button>
        </div>
        {data.mine.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-app-border bg-white px-6 py-8 text-center font-lp-body text-[13px] text-app-muted">Add your college and branch in Settings to get your college and branch communities, or join an interest community below.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">{data.mine.map((c) => <Card key={c.id} c={c} />)}</ul>
        )}
      </section>

      <section aria-label="Discover communities">
        <h2 className="mb-3 flex items-center gap-2 font-lp-display text-[16px] font-semibold text-app-charcoal"><Users size={15} className="text-app-orange" aria-hidden="true" /> Discover</h2>
        {data.discover.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-app-border bg-white px-6 py-8 text-center font-lp-body text-[13px] text-app-muted">You&apos;ve joined every community there is. Start a new one.</p>
        ) : (
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">{data.discover.map((c) => <Card key={c.id} c={c} />)}</ul>
        )}
      </section>
      {creating && <CreateDialog onClose={() => setCreating(false)} />}
    </div>
  );
}
