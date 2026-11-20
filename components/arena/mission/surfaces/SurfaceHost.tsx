"use client";

import type { Outcome, Settings, Surface } from "@/lib/arena-challenges/missions/types";
import { BeamSurface } from "./BeamSurface";
import { ChainSurface } from "./ChainSurface";
import { FeederSurface } from "./FeederSurface";
import { GearsSurface } from "./GearsSurface";
import { NetworkSurface } from "./NetworkSurface";
import { PcbSurface } from "./PcbSurface";
import { SldSurface } from "./SldSurface";
import { TrussSurface } from "./TrussSurface";

export interface SurfaceProps { data: unknown; settings: Settings; setSettings: (s: Settings) => void; disabled: boolean; outcome: Outcome | null }

/** Picks the working screen for a lab. Every surface edits the same settings the server grades; none of them decides a verdict. */
export function SurfaceHost({ surface, ...props }: SurfaceProps & { surface: Surface }) {
  switch (surface) {
    case "pcb": return <PcbSurface {...props} />;
    case "truss": return <TrussSurface {...props} />;
    case "sld": return <SldSurface {...props} />;
    case "network": return <NetworkSurface {...props} />;
    case "chain": return <ChainSurface {...props} />;
    case "gears": return <GearsSurface {...props} />;
    case "feeder": return <FeederSurface {...props} />;
    case "beam": return <BeamSurface {...props} />;
  }
}
