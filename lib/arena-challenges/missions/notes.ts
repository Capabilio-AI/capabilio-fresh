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
  sampling: "Ideal ADC and a 4th-order Butterworth anti-alias filter; quantisation noise is the only error. A teaching model.",
  "fir-filter": "Windowed-sinc design with the response computed from the real coefficients; no coefficient quantisation or fixed-point effects.",
  "digital-link": "AWGN channel, free-space path loss at 2.4 GHz, textbook BER approximations and fixed coding gains. Real links have fading and implementation loss.",
  "am-modulation": "Ideal double-sideband AM with a single-tone message. The carrier in the plot is drawn slower than real so the envelope is visible.",
  "tline-match": "Lossless line with a resistive load and a single quarter-wave section. Real matching uses lossy lines and reactive loads.",
  "mcu-pwm": "Generic up-counting timer with an 8-to-16-bit TOP register. Real chips differ in register names, modes and limits.",
  "rlc-step": "Ideal series RLC with a step supply, no source resistance or component tolerance.",
  transformer: "Equivalent-circuit approximations; price list is fictional. Real designs also consider temperature rise, harmonics and standards.",
  "induction-motor": "Per-phase equivalent circuit without the magnetising branch, constant parameters; no saturation or skin effect.",
  "relay-coordination": "IEC standard-inverse curves with one fault level per relay; real studies cover many fault types and breaker times.",
  "ev-range": "Steady-speed road-load model with fixed drivetrain efficiency and no regenerative braking or battery temperature effects.",
  "vibration-isolation": "Single-degree-of-freedom base excitation with viscous damping; real machines have several modes and rocking.",
  refrigeration: "Second-law-efficiency model, not a real-refrigerant cycle calculation; cost figures are fictional.",
  "hydraulic-cylinder": "Constant 92% efficiency, no line losses, leakage or cushioning. A sizing exercise, not a circuit design.",
  "fin-heat-sink": "One-dimensional fin theory with a constant convection coefficient and an adiabatic fin tip; no radiation or spreading resistance.",
  "concrete-mix": "Illustrative Abrams-type strength law and a simple slump model, not an IS 10262 mix design; cement price is fictional.",
  "retaining-wall": "Rankine active pressure on a smooth vertical wall with level backfill and no water; real walls also check bending and deep failure.",
  "open-channel": "Uniform flow by Manning's equation in a straight prismatic trapezoidal channel; no backwater or structures.",
  reservoir: "Monthly mass balance with no evaporation or seepage and a repeating two-year inflow record; a teaching model, not a yield study.",
};
const BY_FAMILY: Record<Family, string> = {
  ece: "A simplified model that follows the textbook equations. Real components have tolerances and extra effects.",
  eee: "A simplified model that follows the textbook equations. Real equipment has limits not shown here.",
  mech: "A simplified model that follows the textbook equations, for learning rather than for design.",
  civil: "A simplified model that follows the textbook equations, for learning rather than for design.",
};

export const assumptionsFor = (labKey: string, family: Family): string => BY_LAB[labKey] ?? BY_FAMILY[family];
