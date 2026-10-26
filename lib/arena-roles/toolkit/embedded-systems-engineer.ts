import type { RoleToolkit } from "./types";

/** ECE-01 Embedded Systems Engineer. Code workstation (simulated firmware logic) and Calc Sheet; neither is a real MCU, IDE or debugger. */
export const TOOLKIT: RoleToolkit = {
  roleKey: "embedded-systems-engineer",
  roleId: "ECE-01",
  stream: "ECE",
  headline: "Write the firmware logic a new embedded engineer is handed (debouncing, sensor scaling, serial frames, timers) and check the circuit arithmetic around it, on simulated traces.",
  workstations: [
    {
      name: "Code Editor",
      mirrors: ["Arduino IDE", "PlatformIO", "VS Code"],
      toolType: "code_workspace",
      tier: "S",
      runsIn: "browser",
      summary: "Write one Python or JavaScript function that processes a scripted trace (button samples, ADC readings, ticks, bytes) and submit the pin or serial trace it returned.",
    },
    {
      name: "Calc Sheet",
      mirrors: ["Python", "A scientific calculator", "LTspice (hand-check of values)"],
      toolType: "calc_workspace",
      tier: "A",
      runsIn: "server",
      summary: "Work out resistor values, divider voltages, RC time constants and ADC steps from a datasheet-style parameter list and enter the numbers; the server checks them within a tolerance.",
    },
  ],
  environment: [
    { label: "Virtual traces", detail: "Each code ticket scripts its own inputs (button samples, sensor counts, serial bytes, tick counts) and shows worked examples." },
    { label: "Runtimes", detail: "Python (Pyodide) and JavaScript run in your browser; nothing to install and no board to connect." },
    { label: "Formula sheet", detail: "Each calculation ticket lists the formulas it expects, with units, next to the parameters." },
  ],
  firstWeek: [
    "Debounce the door-sensor button",
    "Convert the cold-room ADC readings to temperature",
    "Pick the series resistor for a status LED",
    "Build the UART frame for the sensor node",
    "Stop the heater relay chattering with hysteresis",
    "Fix the watering timer that misbehaves when the millisecond counter wraps",
  ],
  portfolioArtifacts: [
    "Graded code tickets with per-case results, the code kept for the explain-your-work interview",
    "Graded circuit calculations with the per-field checks that passed",
  ],
  honestLimits: [
    "Firmware logic is simulated: your function runs in your browser (client-run) against a scripted trace, and the server only compares the pin or serial trace you submit. It is not a real microcontroller, IDE or debugger and your code is never run or read server-side.",
    "A real embedded IDE and toolchain (compile, link, flash) is not assessed yet.",
    "Peripheral registers, interrupts and an RTOS are not assessed yet.",
    "Real hardware debugging (on-chip debugger, logic analyser, oscilloscope) and real hardware behaviour (noise, timing, wiring) are not assessed yet.",
    "Serial work is UART-style frames on byte lists; I2C and SPI bus behaviour is not modelled.",
    "Circuit calculations are checked as typed numbers within a tolerance; no circuit is simulated or built.",
  ],
};
