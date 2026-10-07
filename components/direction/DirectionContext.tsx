"use client";

import { createContext, useContext, type ReactNode } from "react";

interface DirectionFlags {
  /** From the same server-side `direction.track === "job"` the rest of the app uses — not recomputed here. */
  isJobTrack: boolean;
  /** final year (4-1 onward): AI Interview and Launchpad are visible */
  launchpadOpen: boolean;
}

const Ctx = createContext<DirectionFlags>({ isJobTrack: false, launchpadOpen: false });

export function DirectionProvider({ isJobTrack, launchpadOpen, children }: DirectionFlags & { children: ReactNode }) {
  return <Ctx.Provider value={{ isJobTrack, launchpadOpen }}>{children}</Ctx.Provider>;
}

export const useDirectionFlags = () => useContext(Ctx);
