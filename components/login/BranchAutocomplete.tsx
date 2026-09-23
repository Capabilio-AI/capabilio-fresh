"use client";

import { useEffect, useId, useRef, useState } from "react";
import { GraduationCap } from "lucide-react";
import { searchBranches } from "@/lib/branch-catalog";

interface BranchAutocompleteProps {
  id?: string;
  value: string;
  onChange: (name: string) => void;
}

const MIN_QUERY_LENGTH = 1;

export function BranchAutocomplete({ id, value, onChange }: BranchAutocompleteProps) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  const matches = value.trim().length >= MIN_QUERY_LENGTH ? searchBranches(value) : [];

  useEffect(() => {
    setActiveIndex(-1);
  }, [value]);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSelect = (name: string) => {
    onChange(name);
    setOpen(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!open || matches.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % matches.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + matches.length) % matches.length);
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(matches[activeIndex].name);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <GraduationCap
          size={16}
          className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-lp-text-muted"
        />
        <input
          id={id}
          type="text"
          role="combobox"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-autocomplete="list"
          required
          value={value}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => matches.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Start typing your branch, e.g. AI, CSE, Mechanical"
          autoComplete="off"
          className="w-full rounded border border-lp-border-hairline bg-lp-surface-card py-3 pl-11 pr-4 font-lp-body text-lp-body-sm text-lp-text-ink placeholder:text-lp-text-muted transition-colors focus:border-lp-accent-indigo focus:outline-none focus:ring-2 focus:ring-lp-accent-indigo/25"
        />
      </div>

      {open && matches.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto rounded border border-lp-border-hairline bg-lp-surface-card shadow-lg"
        >
          {matches.map((branch, i) => (
            <li key={branch.name} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(branch.name)}
                className={`block w-full px-4 py-2.5 text-left font-lp-body text-lp-body-sm text-lp-text-ink transition-colors ${
                  i === activeIndex ? "bg-lp-surface-subtle" : "hover:bg-lp-surface-subtle"
                }`}
              >
                {branch.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
