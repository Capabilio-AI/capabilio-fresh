"use client";

import { useCallback, useState } from "react";

/** Per-attempt draft persisted in localStorage (best effort — a blocked store just means no persistence). */
export function useDraft<T>(attemptId: string, key: string, initial: T): [T, (value: T) => void, () => void] {
  const storageKey = `ws-draft:${attemptId}:${key}`;
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = window.localStorage.getItem(storageKey);
      return stored === null ? initial : (JSON.parse(stored) as T);
    } catch {
      return initial;
    }
  });
  const update = useCallback(
    (next: T) => {
      setValue(next);
      try {
        window.localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        // storage unavailable
      }
    },
    [storageKey]
  );
  const clear = useCallback(() => {
    try {
      window.localStorage.removeItem(storageKey);
    } catch {
      // storage unavailable
    }
  }, [storageKey]);
  return [value, update, clear];
}

export interface ToolProps<Content> {
  attemptId: string;
  content: Content;
  closed: boolean;
  submitting: boolean;
  onSubmit: (submission: unknown) => void;
}
