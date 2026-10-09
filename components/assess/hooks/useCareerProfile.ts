"use client";

import { useCallback, useEffect, useState } from "react";
import type { CareerProfile } from "@/lib/assess/career-profile";

async function fetchProfile(): Promise<CareerProfile> {
  const res = await fetch("/api/students/me/career-profile", { cache: "no-store" });
  if (!res.ok) throw new Error("profile request failed");
  return (await res.json()) as CareerProfile;
}

/**
 * The only way client components read the student's numbers. Every surface (result popup, dashboard ELO card, Skills section, Skill
 * Graph tab) calls this hook against the same endpoint, so they show the same values. `initial` lets a server component hand over
 * what it already read, so there is no flash and no second source.
 */
export function useCareerProfile(initial?: CareerProfile | null) {
  const [profile, setProfile] = useState<CareerProfile | null>(initial ?? null);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    return fetchProfile().then((p) => { setProfile(p); setError(null); }).catch(() => setError("We couldn't load your profile. Try again in a moment."));
  }, []);

  useEffect(() => {
    if (initial) return;
    let cancelled = false;
    fetchProfile().then((p) => { if (!cancelled) setProfile(p); }).catch(() => { if (!cancelled) setError("We couldn't load your profile. Try again in a moment."); });
    return () => { cancelled = true; };
  }, [initial]);

  return { profile, loading: !profile && !error, error, refresh };
}
