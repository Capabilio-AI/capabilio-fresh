"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Building2, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { Enums } from "@/lib/supabase/types";

export interface CollegeMatch {
  id: string;
  name: string;
  city: string | null;
  state: string | null;
  college_type: Enums<"college_type">;
}

interface CollegeAutocompleteProps {
  id?: string;
  value: string;
  onChange: (name: string) => void;
  onSelect: (college: CollegeMatch | null) => void;
}

const DEBOUNCE_MS = 250;
const MIN_QUERY_LENGTH = 2;

export function CollegeAutocomplete({ id, value, onChange, onSelect }: CollegeAutocompleteProps) {
  const [matches, setMatches] = useState<CollegeMatch[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();

  useEffect(() => {
    const query = value.trim();
    if (query.length < MIN_QUERY_LENGTH) {
      setMatches([]);
      setOpen(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    const timer = setTimeout(async () => {
      const supabase = createClient();
      const { data } = await supabase
        .from("institutions")
        .select("id, name, city, state, college_type")
        .ilike("name", `%${query}%`)
        .order("name")
        .limit(8);

      if (!cancelled) {
        setMatches(data ?? []);
        setOpen(true);
        setActiveIndex(-1);
        setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
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

  const handleSelect = (college: CollegeMatch) => {
    onChange(college.name);
    onSelect(college);
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
      handleSelect(matches[activeIndex]);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Building2
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
            onSelect(null);
          }}
          onFocus={() => matches.length > 0 && setOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder="Start typing your college name"
          autoComplete="off"
          className="w-full rounded border border-lp-border-hairline bg-lp-surface-card py-3 pl-11 pr-9 font-lp-body text-lp-body-sm text-lp-text-ink placeholder:text-lp-text-muted transition-colors focus:border-lp-accent-indigo focus:outline-none focus:ring-2 focus:ring-lp-accent-indigo/25"
        />
        {loading && (
          <Loader2
            size={15}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 animate-spin text-lp-text-muted"
          />
        )}
      </div>

      {open && matches.length > 0 && (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute z-20 mt-1.5 max-h-64 w-full overflow-y-auto rounded border border-lp-border-hairline bg-lp-surface-card shadow-lg"
        >
          {matches.map((college, i) => (
            <li key={college.id} role="option" aria-selected={i === activeIndex}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => handleSelect(college)}
                className={`flex w-full flex-col items-start gap-0.5 px-4 py-2.5 text-left font-lp-body text-lp-body-sm transition-colors ${
                  i === activeIndex ? "bg-lp-surface-subtle" : "hover:bg-lp-surface-subtle"
                }`}
              >
                <span className="text-lp-text-ink">{college.name}</span>
                {(college.city || college.state) && (
                  <span className="font-lp-mono text-lp-label-sm text-lp-text-muted">
                    {[college.city, college.state].filter(Boolean).join(", ")}
                  </span>
                )}
              </button>
            </li>
          ))}
        </ul>
      )}

      {open && !loading && matches.length === 0 && value.trim().length >= MIN_QUERY_LENGTH && (
        <div className="absolute z-20 mt-1.5 w-full rounded border border-lp-border-hairline bg-lp-surface-card px-4 py-3 font-lp-body text-lp-body-sm text-lp-text-muted shadow-lg">
          No match found — you can still continue with the name you typed.
        </div>
      )}
    </div>
  );
}
