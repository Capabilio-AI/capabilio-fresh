import type { ReactNode } from "react";
import "@/components/metro/metro.css";
import "../assess.css";
import { metroFontVars } from "@/components/metro/font";

export type Stage = "role" | "common" | "career" | "results";

/** The assessment's room: metro fonts and tokens, the assessment palette, and the aurora whose hue follows the stage. */
export function AssessScope({ stage, children }: { stage: Stage; children: ReactNode }) {
  return (
    <div className={`metro ${metroFontVars} a-stage`} data-area="assess" data-stage={stage}>
      <div className="a-backdrop" aria-hidden>
        <span className="a-orb a-orb--1" />
        <span className="a-orb a-orb--2" />
        <span className="a-orb a-orb--3" />
        <span className="a-grid" />
        <span className="a-grain" />
      </div>
      {children}
    </div>
  );
}
