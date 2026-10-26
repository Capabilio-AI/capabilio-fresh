import type { RoleToolkit } from "./types";

/** EEE-03 Industrial Automation / PLC Engineer. The code workstation (logic simulated as a scan function) and the calc workstation, with this role's own areas. */
export const TOOLKIT: RoleToolkit = {
  roleKey: "plc-automation-engineer",
  roleId: "EEE-03",
  stream: "EEE",
  headline: "Write the control logic a machine panel needs, one scan at a time, and check the electrical numbers behind it.",
  workstations: [
    {
      name: "Scan-Cycle Editor",
      mirrors: ["TIA Portal (logic ideas only)", "CODESYS (logic ideas only)"],
      toolType: "code_workspace",
      tier: "S",
      runsIn: "browser",
      summary: "Write a scan(inputs, state) function that returns the outputs and the next state; it is replayed over a scripted input sequence in your browser and the results are submitted.",
    },
    {
      name: "Panel Calculator",
      mirrors: ["Excel", "Manufacturer cable and motor data sheets (formulas only)"],
      toolType: "calc_workspace",
      tier: "A",
      runsIn: "server",
      summary: "Work out motor full-load current, cable size after derating, power-factor correction and 4-20 mA scaling from the ticket's reference sheet; the server checks your numbers.",
    },
  ],
  environment: [
    { label: "Runtimes", detail: "Python (Pyodide) and JavaScript run in your browser for logic tickets; nothing to install." },
    { label: "Scan harness", detail: "Each ticket replays a scripted input sequence one scan at a time, passing the state from the previous scan." },
    { label: "Reference sheet", detail: "Calculation tickets list the formulas and the educational cable table to use." },
  ],
  firstWeek: [
    "Write the start/stop seal-in for a motor with an E-stop",
    "Make a conveyor motor interlock so forward and reverse can never both run",
    "Build an on-delay timer and a rising-edge counter from scan state",
    "Sequence a tank fill pump with level switches",
    "Fix a pump that restarts by itself after the E-stop is released",
    "Size the motor full-load current and the cable for a new pump",
  ],
  portfolioArtifacts: [
    "Graded scan-function tickets with per-scan results, the code kept for the explain-your-work interview",
    "Graded calculation tickets with the checked numbers and the formulas used",
  ],
  honestLimits: [
    "PLC logic is simulated: your function runs in your browser (client-run) and each scan is checked as its own call with the reference state supplied; the server never runs or reads your code.",
    "This is not TIA Portal, CODESYS or a ladder editor: ladder diagrams, function blocks and vendor software are not assessed yet.",
    "No real I/O, wiring, relay behaviour or scan time: timers count scans, not seconds. HMI and SCADA are not assessed yet.",
    "Functional safety design and certification are not assessed; an E-stop here is a logic exercise, not a safety circuit.",
    "Calculations are educational formulas from each ticket's reference sheet; they are not an installation design and claim no approval under any wiring code.",
  ],
};
