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

      <div className="mb-4 flex items-center justify-between">
        <h2 className="font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">Vault</h2>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="flex items-center gap-1.5 rounded-full bg-lp-accent-indigo px-3.5 py-1.5 font-lp-mono text-lp-label-sm font-semibold text-lp-surface-card shadow-sm transition-transform hover:scale-105"
        >
          <Plus size={14} />
          Add item
        </button>
      </div>

      {showForm && <AddItemForm onAdded={addItem} onCancel={() => setShowForm(false)} />}

      {items.length === 0 ? (
        <EmptyState message="Nothing in your vault yet — add a certificate, project, or link to start building your portfolio." />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {items.map((item) => {
            const Icon = TYPE_ICON[item.item_type];
            return (
              <div key={item.id} className="rounded-xl border border-lp-border-hairline bg-lp-surface-card p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2.5">
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-lp-surface-subtle text-lp-text-muted">
                      <Icon size={15} />
                    </span>
                    <div>
                      <p className="flex items-center gap-1 font-lp-body text-lp-body-sm font-medium text-lp-text-ink">
                        {item.title}
                        {item.verified && (
                          <span title="Uploaded file verified" className="flex items-center text-lp-success">
                            <BadgeCheck size={13} />
                          </span>
                        )}
                      </p>
                      <p className="font-lp-mono text-lp-label-sm text-lp-text-muted">{TYPE_LABEL[item.item_type]}</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.id)}
                    aria-label="Delete item"
                    className="text-lp-text-muted transition-colors hover:text-lp-error"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
                {item.description && (
                  <p className="mt-2 font-lp-body text-lp-body-sm text-lp-text-muted">{item.description}</p>
                )}
                {(item.url ?? item.fileUrl) && (
                  <a
                    href={item.url ?? item.fileUrl ?? undefined}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-2 flex items-center gap-1 font-lp-mono text-lp-label-sm text-lp-accent-indigo hover:underline"
                  >
                    <ExternalLink size={12} />
                    {item.fileUrl ? "View certificate" : "View"}
                  </a>
                )}
              </div>
            );
          })}
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
