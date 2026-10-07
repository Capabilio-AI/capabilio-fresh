"use client";

import { useEffect, useRef, useState } from "react";
import type { GraphNode } from "@/lib/roadmap-visual/graph-types";
import { describeChange, diffNodes, memoOf, type Change, type Memo } from "@/lib/roadmap-visual/diff";

const read = (key: string): Memo | null => {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Memo) : null;
  } catch {
    return null;
  }
};
const write = (key: string, memo: Memo) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(memo));
  } catch {
    /* private mode or blocked storage: the banner just won't remember */
  }
};

/** "What changed since you last looked". Remembered per browser; if storage is unavailable it simply stays quiet. */
export function WhatChanged({ nodes, storageKey, onOpen }: { nodes: GraphNode[]; storageKey: string; onOpen: (key: string) => void }) {
  const [changes, setChanges] = useState<Change[]>([]);
  const baseline = useRef<Memo | null | undefined>(undefined);

  useEffect(() => {
    if (baseline.current === undefined) baseline.current = read(storageKey); // what the student last saw, fixed for this visit
    setChanges(diffNodes(baseline.current, nodes));
    write(storageKey, memoOf(nodes));
  }, [nodes, storageKey]);

  if (changes.length === 0) return null;
  return (
    <details open className="rounded-xl border border-app-border bg-white px-4 py-2.5">
      <summary className="cursor-pointer font-lp-body text-[13px] font-medium text-app-charcoal">What changed since you last looked ({changes.length})</summary>
      <ul className="mt-1.5 space-y-0.5 font-lp-body text-[12.5px]">
        {changes.slice(0, 12).map((c) => <li key={c.key}><button type="button" onClick={() => onOpen(c.key)} className="text-app-blue hover:underline">{describeChange(c)}</button></li>)}
      </ul>
    </details>
  );
}
