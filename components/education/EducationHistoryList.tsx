"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { EducationEntryCard } from "./EducationEntryCard";
import { AddEducationHistoryForm } from "./AddEducationHistoryForm";
import type { EducationEntry } from "@/lib/dashboard/education";

export function EducationHistoryList({ entries }: { entries: EducationEntry[] }) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [addingNew, setAddingNew] = useState(false);

  function handleSaved(membershipId: string) {
    setEditingId(null);
    setAddingNew(false);
    setVerifyingId(membershipId);
  }

  if (entries.length === 0 && !addingNew) {
    return (
      <div className="rounded-xl border border-dashed border-app-border bg-white p-6 text-center">
        <p className="font-lp-body text-[13px] text-app-muted">No educational history on record yet.</p>
        <button
          type="button"
          onClick={() => setAddingNew(true)}
          className="mt-3 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white"
        >
          Add educational history
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      {entries.map((entry) => (
        <EducationEntryCard
          key={entry.id}
          entry={entry}
          mode={verifyingId === entry.id ? "verify" : editingId === entry.id ? "edit" : "view"}
          onEdit={() => setEditingId(entry.id)}
          onVerify={() => setVerifyingId(entry.id)}
          onSaved={handleSaved}
          onDoneVerifying={() => setVerifyingId(null)}
        />
      ))}

      {addingNew ? (
        <AddEducationHistoryForm onSaved={handleSaved} />
      ) : (
        <button
          type="button"
          onClick={() => setAddingNew(true)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-app-border bg-white py-3 font-lp-mono text-[12px] font-semibold text-app-muted hover:text-app-charcoal"
        >
          <Plus size={14} />
          Add another institution
        </button>
      )}
    </div>
  );
}
