import type { RoleToolkit } from "./types";

/** MECH-01 Mechanical Design Engineer. One calculation workstation (tier S) with this role's own areas; CAD, FEA and drawings are not modelled. */
export const TOOLKIT: RoleToolkit = {
  roleKey: "mechanical-design-engineer",
  roleId: "MECH-01",
  stream: "Mechanical",
  headline: "Do the hand calculations a new design engineer is asked for: reactions, stresses, fits, drive and fastener sizing, and a first material choice.",
  workstations: [
    {
      name: "Calculation Worksheet",
      mirrors: ["Excel / Google Sheets", "MathCAD", "Machinery's Handbook formula tables"],
      toolType: "calc_workspace",
      tier: "S",
      runsIn: "server",
      summary: "Read the ticket's seeded numbers and formula sheet, work the calculation, and enter each result in its unit; the server checks them within a tolerance.",
    },
  ],
  environment: [
    { label: "Seeded parameters", detail: "Every ticket opens with its own loads, dimensions and material values, different each time." },
    { label: "Formula reference sheet", detail: "The standard formulas for the ticket are listed beside the numbers; you apply them, you do not have to recall them." },
    { label: "Calculator", detail: "Use any calculator or spreadsheet you like; only the numbers you enter are checked." },
  ],
  firstWeek: [
    "Find the support reactions of a beam under a point load",
    "Check a hanger rod's stress and factor of safety",
    "Work out the clearance range of a shaft and hole fit",
    "Size the output speed and torque of a gear stage",
    "Pick the cheapest material that carries a tie rod's load",
    "Find the preload and tightening torque of a flange bolt",
  ],
  portfolioArtifacts: [
    "Graded calculation tickets with per-result checks (right or off, never the answer key), kept for the explain-your-work interview",
  ],
  honestLimits: [
    "Educational calculation only: passing a ticket is never an approval of a real design, which needs standards, load cases, fatigue and buckling checks and an engineer's sign-off.",
    "3D CAD, finite element analysis, engineering drawings and GD&T are not assessed yet.",
    "The server compares your numbers with its own within a tolerance; it does not see or grade your working.",
    "Cases are textbook ones (simple supports, uniform sections, steady loads); combined loading and stress concentration are not covered.",
    "Material choices use numbers on a fictional supplier sheet, not a real material database.",
  ],
};
