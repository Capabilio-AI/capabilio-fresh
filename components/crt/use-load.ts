"use client";

import { useEffect, useState } from "react";
import { crtPost } from "./api";

/** Fetches one CRT action when mounted and whenever `body` changes (add a `nonce` field to reload). Never shows data from an earlier request. */
export function useLoad<T>(body: Record<string, unknown>): { data: T | null; error: string | null } {
  const key = JSON.stringify(body);
  const [state, setState] = useState<{ key: string; data: T | null; error: string | null }>({ key: "", data: null, error: null });
  useEffect(() => {
    let live = true;
    // the nonce only forces a reload; the server never sees it
    const { nonce: _nonce, ...request } = JSON.parse(key) as Record<string, unknown>;
    crtPost<T>(request)
      .then((data) => live && setState({ key, data, error: null }))
      .catch((e: Error) => live && setState({ key, data: null, error: e.message }));
    return () => {
      live = false;
    };
  }, [key]);
  return state.key === key ? { data: state.data, error: state.error } : { data: null, error: null };
}
