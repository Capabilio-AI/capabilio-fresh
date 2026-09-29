"use client";

import { createContext, useContext, type ReactNode } from "react";

interface DirectionFlags {
  /** From the same server-side `direction.track === "job"` the rest of the app uses — not recomputed here. */
  isJobTrack: boolean;
}

const Ctx = createContext<DirectionFlags>({ isJobTrack: false });

export function DirectionProvider({ isJobTrack, children }: DirectionFlags & { children: ReactNode }) {
  return <Ctx.Provider value={{ isJobTrack }}>{children}</Ctx.Provider>;
}

export const useDirectionFlags = () => useContext(Ctx);
