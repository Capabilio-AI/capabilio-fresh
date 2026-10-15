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
}

const Ctx = createContext<DirectionFlags>({ isJobTrack: false, launchpadOpen: false, stage: "student" });

export function DirectionProvider({ isJobTrack, launchpadOpen, stage, children }: DirectionFlags & { children: ReactNode }) {
  return <Ctx.Provider value={{ isJobTrack, launchpadOpen, stage }}>{children}</Ctx.Provider>;
}

export const useDirectionFlags = () => useContext(Ctx);
