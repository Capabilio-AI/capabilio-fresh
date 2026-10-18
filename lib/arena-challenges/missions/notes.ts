import type { Family } from "./types";

/** What each lab's model assumes, shown on the bench so a student never mistakes it for a professional design or site check. */
const BY_LAB: Record<string, string> = {
  beam: "Elastic bending of a simply supported rectangular beam, self-weight ignored. A teaching model, not a structural design check.",
  "rcc-column": "A short axially loaded column using the IS 456 strength expression, with minimum eccentricity ignored. A teaching model, not a structural design check.",
  foundation: "Allowable bearing pressure and elastic settlement from simple soil constants, for one uniform layer. A teaching model, not a site investigation or foundation design.",
  crane: "A rigid boom in static equilibrium with a single rope; no dynamic load factor or boom self-weight. A teaching model, not a lifting-equipment design check.",
  pipeline: "Darcy–Weisbach friction with fixed fittings loss and a constant pump head. A teaching model, not a hydraulic design.",
  otto: "Air-standard Otto cycle with a fixed brake-efficiency fraction. Real engines differ.",
  "heat-exchanger": "Effectiveness–NTU method with constant properties and a flow-dependent U. A teaching model, not a thermal design.",
  levelling: "Expected random error only, with equal fore and back sights so systematic effects cancel. Real surveys add field checks.",
  "signal-timing": "Webster's delay formula for a two-phase junction with steady demand. Real junctions have turning movements and pedestrians.",
  "solar-farm": "Annual-average sunshine with a fixed system derate. A teaching model, not a yield forecast.",
  amplifier: "Ideal transistor with β = 100 and a fixed VBE; ignores temperature and load. A teaching model.",
  "dc-motor": "Steady-state DC shunt motor with constant flux for each field setting; no saturation or commutation effects.",
  "voltage-regulation": "Per-unit radial feeder model with a single load. A teaching model, not a power-system study.",
};
const BY_FAMILY: Record<Family, string> = {
  ece: "A simplified model that follows the textbook equations. Real components have tolerances and extra effects.",
  eee: "A simplified model that follows the textbook equations. Real equipment has limits not shown here.",
  mech: "A simplified model that follows the textbook equations, for learning rather than for design.",
  civil: "A simplified model that follows the textbook equations, for learning rather than for design.",
};

export const assumptionsFor = (labKey: string, family: Family): string => BY_LAB[labKey] ?? BY_FAMILY[family];
