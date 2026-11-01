import { ROLE_CATALOG, type CatalogRole } from "./catalog";

/**
 * The roles Capabilio launches Arena with: first all 15 IT roles (wave 1), then three per college branch (wave 2). Picked from the catalog (never a parallel list) by what the
 * uploaded curricula teach in COMPULSORY courses, because electives differ by college and a role only helps if most students have studied its core:
 *   MECH  Design (Machine Elements, Solids, CAD/FEM), Manufacturing/Production (Processes, Machine Tools & Metrology), Thermal/HVAC (Thermodynamics, Heat Transfer)
 *   CIVIL Site (Surveying, Concrete, Building Materials), Structural Design (Structural Analysis, RCC/Steel Design), QS/Estimation (Estimation & Contracts, Valuation)
 *   ECE   Embedded (Microcontrollers, Embedded), VLSI (Switching Theory, HDL, VLSI), Communication/RF (Analog/Digital Comms, DSP, Antennas)
 *   EEE   Power Systems (Power Systems I/II, Protection), Industrial Automation/PLC (Control, Drives, PLC), Electrical Design (Machines, Circuits, Power Electronics)
 * Not launched yet: the other two roles of each branch, and the MBA and MCA streams.
 */
const BRANCH_LAUNCH: Readonly<Record<string, readonly string[]>> = {
  MECH: ["MECH-01", "MECH-02", "MECH-05"],
  CIVIL: ["CIVIL-01", "CIVIL-02", "CIVIL-03"],
  ECE: ["ECE-01", "ECE-02", "ECE-04"],
  EEE: ["EEE-01", "EEE-02", "EEE-03"],
};

/** Wave 1: the 15 IT roles, each finished end to end (skills, sign-up screen, workstation, proof) before any branch role starts. */
export const LAUNCH_ROLES: readonly CatalogRole[] = ROLE_CATALOG.filter((r) => r.stream === "IT");

/** Wave 2: three per branch, started only once the IT system is proven with real students. */
export const BRANCH_WAVE_ROLES: readonly CatalogRole[] = ROLE_CATALOG.filter((r) => BRANCH_LAUNCH[r.stream]?.includes(r.id));
