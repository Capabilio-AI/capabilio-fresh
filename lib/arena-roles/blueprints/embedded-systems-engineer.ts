import type { BlueprintArea, RoleBlueprint } from "../blueprint";

const code = (areaKey: string, competencies: string[]): BlueprintArea => ({ areaKey, toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies });

/**
 * ECE-01 Embedded Systems Engineer. Mirrors supabase/migrations/136_embedded_systems_engineer_role.sql (not applied).
 *
 * Firmware LOGIC is simulated, not run on a microcontroller. Code tickets are one function over a scripted virtual trace (button samples, ADC
 * readings, ticks, serial bytes) that runs in the student's browser; the server compares the pin or serial trace it returned with its own answers.
 * Circuit calculations use the calc workstation, which checks typed numbers against a computed key.
 * Templates: lib/workplace/embedded/code-problems.ts and lib/workplace/calc/embedded.ts.
 */
export const EMBEDDED_SYSTEMS_ENGINEER: RoleBlueprint = {
  roleId: "ECE-01",
  domainRoleKey: "embedded-systems-engineer",
  name: "Embedded Systems Engineer",
  competencies: [
    { id: "emb.gpio", label: "Reading digital inputs: debouncing and edge detection" },
    { id: "emb.state-machines", label: "Tick-based state machines driving outputs (LED modes)" },
    { id: "emb.adc", label: "ADC scaling with integer arithmetic" },
    { id: "emb.thresholds", label: "Thresholds, hysteresis and filtering sensor readings" },
    { id: "emb.serial", label: "Serial framing: building and parsing frames with a checksum" },
    { id: "emb.timing", label: "Timer ticks, 32-bit millisecond rollover and PWM duty cycle" },
    { id: "emb.circuits", label: "Circuit arithmetic: LED resistor, voltage divider, RC time constant, ADC resolution" },
    { id: "emb.debugging", label: "Finding and fixing a firmware logic defect from a failing trace" },
  ],
  unassessed: [
    { id: "emb.ide", label: "A real embedded IDE and toolchain: compiling, linking, flashing a board" },
    { id: "emb.registers", label: "Peripheral registers, memory-mapped I/O and datasheet-driven configuration" },
    { id: "emb.interrupts", label: "Interrupts, ISRs and concurrency between them and the main loop" },
    { id: "emb.rtos", label: "An RTOS: tasks, queues, semaphores and scheduling" },
    { id: "emb.hw-debug", label: "Hardware debugging: on-chip debugger, logic analyser, oscilloscope" },
    { id: "emb.hardware", label: "Real hardware: wiring, soldering, sensors' actual noise and timing" },
  ],
  areas: [
    code("emb-gpio-state-machines", ["emb.gpio", "emb.state-machines"]),
    code("emb-sensors-and-thresholds", ["emb.adc", "emb.thresholds"]),
    code("emb-serial-protocols", ["emb.serial"]),
    code("emb-timing", ["emb.timing", "emb.debugging"]),
    { areaKey: "emb-circuit-calcs", toolType: "calc_workspace", generationVersion: "calc.gen.v1", gradingVersion: "calc.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["emb.circuits"] },
  ],
  limitations: [
    "Firmware logic is simulated. The student's function runs in their own browser against a scripted virtual trace (button samples, sensor readings, ticks, bytes); the server compares the returned pin or serial trace with its own answers and never runs or reads the code. This is not a real microcontroller, IDE or debugger.",
    "Anyone can produce the right traces by any means, so the explain-your-work interview is the only check that the student understands their solution.",
    "Each ticket is one pure function over a recorded trace. There are no registers, interrupts, an RTOS, memory limits or real-time deadlines, and no real sensor noise or electrical behaviour; these, real IDE use and hardware debugging are listed as unassessed.",
    "Serial work covers UART-style frame building and parsing with a checksum on byte lists; I2C or SPI bus behaviour (addressing, clock stretching, acknowledgements) is not modelled.",
    "Circuit calculations are typed numbers checked against a computed key with a tolerance; no circuit is simulated, drawn or built.",
    "Tickets come only from fixed templates (no AI-written variants), so a student can meet the same ticket again.",
  ],
};
