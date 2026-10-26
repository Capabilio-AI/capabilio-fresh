import type { RoleBlueprint } from "../blueprint";

/**
 * MECH-01 Mechanical Design Engineer. Mirrors supabase/migrations/139_mechanical_design_engineer_role.sql (not applied).
 *
 * Every ticket is a calculation worksheet on the calculation workstation (lib/workplace/calc/mech.ts): seeded numbers, a formula reference sheet,
 * and the student's results checked against the server's own answers within a tolerance. CAD, FEA and drawings are not assessed.
 */
export const MECHANICAL_DESIGN_ENGINEER: RoleBlueprint = {
  roleId: "MECH-01",
  domainRoleKey: "mechanical-design-engineer",
  name: "Mechanical Design Engineer",
  competencies: [
    { id: "mde.statics", label: "Statics: support reactions, bending moments and free-body thinking" },
    { id: "mde.stress", label: "Axial, bending and shear stress, factor of safety and simple beam deflection" },
    { id: "mde.fits", label: "Tolerance stack-up and clearance, transition and interference fits" },
    { id: "mde.power", label: "Power transmission: gear ratio, shaft torque and stress, belt speed and basic bearing life" },
    { id: "mde.materials", label: "Choosing a material from numbers: yield strength, density and cost against a load" },
    { id: "mde.fasteners", label: "Bolt preload, tightening torque and shear capacity" },
  ],
  unassessed: [
    { id: "mde.cad", label: "3D CAD modelling and assemblies (SolidWorks, CATIA, Creo)" },
    { id: "mde.fea", label: "Finite element analysis: meshing, boundary conditions and reading results" },
    { id: "mde.drawings", label: "Engineering drawings and GD&T (datums, feature control frames, tolerance zones)" },
    { id: "mde.verification", label: "Verifying a real design: standards, load cases, fatigue, buckling and approval" },
    { id: "mde.manufacture", label: "Design for manufacture and assembly, and working with a shop floor" },
  ],
  areas: [
    { areaKey: "mech-statics-and-loads", toolType: "calc_workspace", generationVersion: "calc.gen.v1", gradingVersion: "calc.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["mde.statics"] },
    { areaKey: "mech-stress-and-strength", toolType: "calc_workspace", generationVersion: "calc.gen.v1", gradingVersion: "calc.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["mde.stress"] },
    { areaKey: "mech-fits-and-tolerances", toolType: "calc_workspace", generationVersion: "calc.gen.v1", gradingVersion: "calc.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["mde.fits"] },
    { areaKey: "mech-power-transmission", toolType: "calc_workspace", generationVersion: "calc.gen.v1", gradingVersion: "calc.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["mde.power"] },
    { areaKey: "mech-materials-and-selection", toolType: "calc_workspace", generationVersion: "calc.gen.v1", gradingVersion: "calc.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["mde.materials"] },
    { areaKey: "mech-fasteners", toolType: "calc_workspace", generationVersion: "calc.gen.v1", gradingVersion: "calc.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["mde.fasteners"] },
  ],
  limitations: [
    "Every ticket is a calculation worksheet: the server draws seeded numbers, keeps its own answers and compares yours within a small tolerance. It does not see your working, so the explain-your-work interview is the only check that you understand the method.",
    "CAD modelling, finite element analysis, engineering drawings and GD&T are not assessed; there is no modelling or drawing workstation yet.",
    "The numbers are educational. A passed ticket never approves a real design: real verification needs standards, load cases, fatigue and buckling checks, and a sign-off by a qualified engineer.",
    "Beams, rods, shafts, fits, bearings and bolts are textbook cases (simple supports, uniform sections, steady loads). Combined loading, stress concentration and dynamic effects are out of scope.",
    "Material selection is done from numbers on a fictional supplier sheet (yield strength, density, cost), not from a real material database or standard.",
    "Tickets come only from fixed templates, so a student can meet the same kind of ticket again with different numbers.",
  ],
};
