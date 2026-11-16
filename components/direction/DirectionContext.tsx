"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { CareerStage } from "@/lib/stage/stage";

interface DirectionFlags {
  /** From the same server-side `direction.track === "job"` the rest of the app uses — not recomputed here. */
  isJobTrack: boolean;
  /** final year (4-1 onward): AI Interview and Launchpad are visible */
  launchpadOpen: boolean;
  /** the profile's career stage: student, graduate or professional */
  stage: CareerStage;
  /** a student who skipped the role has no skill passport, skills or roadmap tabs; everyone else has them */
  hasRole: boolean;
  /** year of study, null when unknown */
  year: number | null;
}

const Ctx = createContext<DirectionFlags>({ isJobTrack: false, launchpadOpen: false, stage: "student", hasRole: true, year: null });

export function DirectionProvider({ isJobTrack, launchpadOpen, stage, hasRole, year, children }: DirectionFlags & { children: ReactNode }) {
  return <Ctx.Provider value={{ isJobTrack, launchpadOpen, stage, hasRole, year }}>{children}</Ctx.Provider>;
}

export const useDirectionFlags = () => useContext(Ctx);
