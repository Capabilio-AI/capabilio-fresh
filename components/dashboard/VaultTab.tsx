"use client";

import { useEffect, useState } from "react";
import {
  Award,
  BadgeCheck,
  ExternalLink,
  FileText,
  Link2,
  Loader2,
  Plus,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import { EmptyState } from "@/components/dashboard/SkillsTab";
import { CodeDnaCard } from "@/components/vault/CodeDnaCard";

type ItemType = "certificate" | "project" | "resume" | "link" | "other";

interface VaultItem {
  id: string;
  item_type: ItemType;
  title: string;
  url: string | null;
  description: string | null;
  created_at: string;
  verified: boolean;
  fileUrl: string | null;
}

const TYPE_ICON: Record<ItemType, LucideIcon> = {
  certificate: Award,
  project: Sparkles,
  resume: FileText,
  link: Link2,
  other: FileText,
};
const TYPE_LABEL: Record<ItemType, string> = {
  certificate: "Certificate",
  project: "Project",
  resume: "Resume",
  link: "Link",
  other: "Other",
};

const SECTION_ORDER: ItemType[] = ["certificate", "project", "resume", "link", "other"];
const SECTION_TITLE: Record<ItemType, string> = { certificate: "Certifications", project: "Projects", resume: "Resumes", link: "Links", other: "Other documents" };
const SECTION_INTRO: Record<ItemType, string> = {
  certificate: "Courses and credentials you have earned. Uploaded files are checked.",
  project: "Things you have built, with a repository or demo link.",
  resume: "The versions of your resume you share with recruiters.",
  link: "Profiles and pages that show your work.",
  other: "Supporting files that back up your record.",
};

const INPUT =
  "w-full rounded-lg border border-lp-border-hairline bg-lp-surface-card px-3.5 py-2.5 font-lp-body text-lp-body-sm text-lp-text-ink placeholder:text-lp-text-muted focus:border-lp-accent-indigo focus:outline-none focus:ring-2 focus:ring-lp-accent-indigo/25";

export function VaultTab() {
  const [items, setItems] = useState<VaultItem[] | null>(null);
  const [showForm, setShowForm] = useState(false);

  useEffect(() => {
    fetch("/api/vault")
      .then((res) => res.json())
      .then((data) => setItems(data.items ?? []));
  }, []);

  function addItem(item: VaultItem) {
    setItems((prev) => [item, ...(prev ?? [])]);
    setShowForm(false);
  }

  function removeItem(id: string) {
    const prevItems = items;
    setItems((prev) => (prev ?? []).filter((i) => i.id !== id));
    fetch(`/api/vault/${id}`, { method: "DELETE" }).then((res) => {
      if (!res.ok) setItems(prevItems);
    });
  }

  if (items === null) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin text-lp-accent-indigo" />
      </div>
    );
  }

  return (
    <div>
      <CodeDnaCard />

      <div className="mb-5 flex justify-end">
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-full bg-[var(--m-ink)] px-4 py-2 text-[13px] font-bold text-white transition-transform hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"
        >
          <Plus size={14} aria-hidden />
          Add item
        </button>
      </div>

      {showForm && <AddItemForm onAdded={addItem} onCancel={() => setShowForm(false)} />}

      {items.length === 0 ? (
        <EmptyState message="Nothing here yet. Add a certificate, project, resume or link to start building your portfolio." />
      ) : (
        <div className="flex flex-col gap-8">
          {SECTION_ORDER.filter((type) => items.some((i) => i.item_type === type)).map((type) => (
            <section key={type} aria-labelledby={`vault-${type}`}>
              <h2 id={`vault-${type}`} className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">{SECTION_TITLE[type]}</h2>
              <p className="mb-3 mt-0.5 font-lp-body text-[13.5px] text-app-muted">{SECTION_INTRO[type]}</p>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {items.filter((i) => i.item_type === type).map((item) => {
                  const Icon = TYPE_ICON[item.item_type];
                  return (
                    <div key={item.id} className="rounded-xl border border-[var(--m-rule)] bg-white p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2.5">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[var(--m-ground)] text-[var(--m-ink)]"><Icon size={15} aria-hidden /></span>
                          <p className="flex items-center gap-1 font-lp-body text-[14px] font-bold text-[var(--m-ink)]">
                            {item.title}
                            {item.verified && <span title="Uploaded file verified" className="flex items-center text-[#0d7a45]"><BadgeCheck size={14} aria-hidden /></span>}
                          </p>
                        </div>
                        <button type="button" onClick={() => removeItem(item.id)} aria-label={`Delete ${item.title}`} className="text-[var(--m-muted)] transition-colors hover:text-[#ba1a1a]"><Trash2 size={15} aria-hidden /></button>
                      </div>
                      {item.description && <p className="mt-2 font-lp-body text-[13px] text-app-muted">{item.description}</p>}
                      {(item.url ?? item.fileUrl) && (
                        <a href={item.url ?? item.fileUrl ?? undefined} target="_blank" rel="noopener noreferrer" className="mt-2 flex items-center gap-1 text-[12.5px] font-bold text-[var(--m-accent-ink)] hover:underline">
                          <ExternalLink size={12} aria-hidden />{item.fileUrl ? "View certificate" : "View"}
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function AddItemForm({ onAdded, onCancel }: { onAdded: (item: VaultItem) => void; onCancel: () => void }) {
  const [itemType, setItemType] = useState<ItemType>("project");
  const [title, setTitle] = useState("");
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/vault", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ itemType, title: title.trim(), url: url.trim(), description: description.trim() }),
    });
    setSaving(false);
    if (!res.ok) {
      setError("Could not save — check the fields and try again.");
      return;
    }
    const { item } = await res.json();
    onAdded(item);
  }

  return (
    <div className="mb-4 flex flex-col gap-3 rounded-xl border border-lp-border-hairline bg-lp-surface-subtle p-4">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <select value={itemType} onChange={(e) => setItemType(e.target.value as ItemType)} className={INPUT}>
          {Object.entries(TYPE_LABEL).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className={INPUT}
        />
      </div>
      <input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="Link (optional)"
        className={INPUT}
      />
      <textarea
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        placeholder="Description (optional)"
        rows={2}
        className={INPUT}
      />
      {error && <p className="font-lp-body text-lp-body-sm text-lp-error">{error}</p>}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="rounded-lg px-3.5 py-2 font-lp-body text-lp-body-sm font-medium text-lp-text-muted hover:text-lp-text-ink"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={saving || title.trim().length === 0}
          className="rounded-lg bg-lp-text-ink px-4 py-2 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save"}
        </button>
      </div>
    </div>
  );
}
