import type { BlueprintArea, RoleBlueprint } from "../blueprint";

/**
 * CIVIL-01 Site Engineer. Mirrors supabase/migrations/140_site_engineer_role.sql (not applied).
 *
 * A civil fresher's first job is site arithmetic: quantities, concrete batching, levels, rate x quantity bills, progress and simple load limits.
 * One shared workstation serves every area (calc_workspace, a calculation worksheet with a formula and stated-factor sheet and seeded site data;
 * lib/workplace/calc/site.ts). The server derives each expected number from the ticket's own parameters and checks the student's typed answers
 * within a tolerance. Factors are stated on the sheet for the exercise; nothing here claims code compliance.
 */
const calc = (areaKey: string, competencies: string[]): BlueprintArea => ({ areaKey, toolType: "calc_workspace", generationVersion: "calc.gen.v1", gradingVersion: "calc.grade.v1", executionMode: "computed-key", status: "enabled", competencies });

export const SITE_ENGINEER: RoleBlueprint = {
  roleId: "CIVIL-01",
  domainRoleKey: "site-engineer",
  name: "Site Engineer",
  competencies: [
    { id: "se.quantities", label: "Taking off quantities: concrete volumes, brickwork, plaster area, steel from bar lengths" },
    { id: "se.mix", label: "Converting a nominal concrete mix to batch quantities, wastage and water" },
    { id: "se.cubes", label: "Reading cube-test results against a stated acceptance rule" },
    { id: "se.levels", label: "Reducing levels (height of collimation, rise and fall), gradients and cut or fill" },
    { id: "se.cost", label: "Rate x quantity bill lines, overhead, profit and GST stacking" },
    { id: "se.stock", label: "Reconciling material stock against issues and wastage" },
    { id: "se.progress", label: "Productivity, crew-days, value-weighted progress and simple schedule delay" },
    { id: "se.load-limits", label: "Comparing a load with a stated capacity and counting site PPE" },
  ],
  unassessed: [
    { id: "se.drawings", label: "Reading and marking up construction drawings and BBS schedules" },
    { id: "se.cad", label: "CAD and BIM tools" },
    { id: "se.structural", label: "Structural analysis and design software" },
    { id: "se.code", label: "Real code compliance: IS code clauses, mix design and acceptance procedures" },
    { id: "se.safety-signoff", label: "Site safety sign-off, scaffold and lifting-plan approval, permit to work" },
    { id: "se.site-practice", label: "Setting out with a real total station or level, supervising a crew and inspecting workmanship" },
  ],
  areas: [
    calc("site-quantities", ["se.quantities"]),
    calc("site-concrete-mix", ["se.mix", "se.cubes"]),
    calc("site-levels-and-surveying", ["se.levels"]),
    calc("site-materials-and-cost", ["se.cost", "se.stock"]),
    calc("site-progress-and-planning", ["se.progress"]),
    calc("site-safety-calcs", ["se.load-limits"]),
  ],
  limitations: [
    "Every ticket is a calculation worksheet: the server computes the expected numbers from the ticket's own parameters and checks the numbers you type within a tolerance. The working that produced them is never seen, so the explain-your-work interview is the only check of understanding.",
    "Formulas and factors (brick count per m3, unit weight of steel, mix proportions, wastage, GST rate, acceptance rule) are stated on each ticket's reference sheet for the exercise. They are educational values, not a claim of compliance with any IS code, and using them is not approval of real work.",
    "Drawings, CAD and BIM, structural design software and real code compliance are not assessed: quantities come from given dimensions, not from reading a drawing.",
    "Site safety sign-off is not assessed. Scaffold, hoist and PPE tickets compare two numbers against a stated limit; they never approve a real scaffold, lift or method statement.",
    "Levelling is arithmetic on given staff readings; no real instrument is used and no field-book or closing-error adjustment is assessed.",
    "Tickets come only from fixed templates with seeded numbers (no AI-written variants), so a student can meet the same kind of ticket again with different values.",
    "Companies, projects and people in the tickets are fictional.",
  ],
};
