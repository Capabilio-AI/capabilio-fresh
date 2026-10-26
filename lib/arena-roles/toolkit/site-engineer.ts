import type { RoleToolkit } from "./types";

/** CIVIL-01 Site Engineer. One simulator workstation (calc_workspace) serves all six areas; the sheet states its own factors. */
export const TOOLKIT: RoleToolkit = {
  roleKey: "site-engineer",
  roleId: "CIVIL-01",
  stream: "Civil",
  headline: "Do the arithmetic a new site engineer is handed every week: quantities, concrete batches, levels, bills, progress and simple load limits.",
  workstations: [
    {
      name: "Site Calculation Sheet",
      mirrors: ["Microsoft Excel", "Site diary and measurement book", "Handheld scientific calculator"],
      toolType: "calc_workspace",
      tier: "S",
      runsIn: "server",
      summary: "Read the ticket's site data and formula sheet, work the numbers, and type each result in its unit; the server checks them within a tolerance.",
    },
  ],
  environment: [
    { label: "Seeded site data", detail: "Dimensions, readings, rates and counts for a fictional Indian project are already on the ticket. Nothing to measure or download." },
    { label: "Formula and factor sheet", detail: "Each ticket lists the formulas and the stated factors it uses (for example bricks per m3 or unit weight of steel). Use those, not a remembered value." },
    { label: "Units", detail: "Metres, square metres, cubic metres, kilograms, bags and rupees; every answer field shows its unit." },
  ],
  firstWeek: [
    "Work out the concrete for the isolated footings",
    "Convert an M20 nominal mix to cement, sand and aggregate for a pour",
    "Reduce levels from a level book by height of collimation",
    "Price the plinth works as bill of quantities lines",
    "Work out crew-days and duration for the blockwork",
    "Check a scaffold platform's load against its stated limit",
  ],
  portfolioArtifacts: [
    "Graded calculation tickets with per-result pass or fail, the answers kept for the explain-your-work interview",
    "A record of the areas covered: quantities, concrete mix, levels, cost, progress and load limits",
  ],
  honestLimits: [
    "These are calculation worksheets: the server checks the numbers you type, not your working, so you may be asked to explain it.",
    "Factors on the sheet are stated for the exercise; they are not a claim of IS-code compliance, and nothing here approves real work.",
    "Drawings, CAD and BIM, and structural design software are not assessed; dimensions are given, not read from a drawing.",
    "Site safety sign-off, scaffold and lifting-plan approval are not assessed; load-limit tickets only compare a load with a stated capacity.",
    "No real level, total station or field book is used; levelling is arithmetic on the readings given.",
    "Projects, contractors and people are fictional.",
  ],
};
