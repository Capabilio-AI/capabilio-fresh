"use client";

import { useState } from "react";
import { Check, Landmark } from "lucide-react";
import { Modal } from "./Modal";
import { Institution } from "./auth";

interface InstitutionPickerProps {
  open: boolean;
  name: string;
  institutions: Institution[];
  onContinue: (institution: Institution) => void;
  onClose: () => void;
}

export function InstitutionPicker({
  open,
  name,
  institutions,
  onContinue,
  onClose,
}: InstitutionPickerProps) {
  const [selectedId, setSelectedId] = useState(institutions[0]?.id);
  const selected = institutions.find((i) => i.id === selectedId);

  return (
    <Modal open={open} onClose={onClose} titleId="institution-picker-title">
      <h2 id="institution-picker-title" className="font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
        Welcome back, {name}
      </h2>
      <p className="mt-2 font-lp-body text-lp-body-sm text-lp-text-muted">Select your workspace:</p>

      <div role="radiogroup" aria-label="Institution" className="mt-5 flex flex-col gap-2.5">
        {institutions.map((institution) => {
          const isSelected = institution.id === selectedId;
          return (
            <button
              key={institution.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => setSelectedId(institution.id)}
              className={`flex items-center gap-3 rounded border px-4 py-3.5 text-left font-lp-body text-lp-body-sm font-medium transition-colors ${
                isSelected
                  ? "border-lp-accent-indigo bg-lp-surface-subtle text-lp-text-ink"
                  : "border-lp-border-hairline bg-lp-surface-card text-lp-on-surface-variant hover:border-lp-text-ink"
              }`}
            >
              <Landmark size={16} className="shrink-0 text-lp-accent-indigo" aria-hidden="true" />
              <span className="flex-1">{institution.name}</span>
              {isSelected && <Check size={16} className="text-lp-accent-indigo" aria-hidden="true" />}
            </button>
          );
        })}
      </div>

      <button
        type="button"
        disabled={!selected}
        onClick={() => selected && onContinue(selected)}
        className="mt-6 w-full rounded bg-lp-text-ink py-3 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card transition-colors hover:bg-lp-inverse-surface disabled:cursor-not-allowed disabled:opacity-60"
      >
        Continue
      </button>
    </Modal>
  );
}
