import type { RoleBlueprint } from "../blueprint";

/**
 * EEE-03 Industrial Automation / PLC Engineer. Mirrors supabase/migrations/138_plc_automation_engineer_role.sql (not applied).
 *
 * PLC logic is SIMULATED. A logic ticket asks for one pure scan-cycle function, scan(inputs, state) -> {outputs, state}, that the student writes and runs
 * in their own browser; the scripted input sequence is replayed one scan at a time with the reference state supplied, and the server compares the
 * outputs and state it is sent with its own answers. It is not TIA Portal, CODESYS or a ladder editor. Electrical calculation tickets use the calc
 * workstation (the server holds the expected numbers). Templates: lib/workplace/plc.
 */
export const PLC_AUTOMATION_ENGINEER: RoleBlueprint = {
  roleId: "EEE-03",
  domainRoleKey: "plc-automation-engineer",
  name: "Industrial Automation / PLC Engineer",
  competencies: [
    { id: "plc.boolean", label: "Boolean control logic: seal-in (latch), start/stop and E-stop behaviour" },
    { id: "plc.interlocks", label: "Interlocks that make two outputs mutually exclusive" },
    { id: "plc.timers", label: "Scan-based timers: on-delay (TON) accumulators and presets" },
    { id: "plc.counters", label: "Counters: rising-edge detection, count-up (CTU) and reset" },
    { id: "plc.sequences", label: "Process sequences as state machines: tank level, conveyor steps, traffic-light phases" },
    { id: "plc.faults", label: "Fault handling: debouncing, latched alarms with acknowledge, fail-safe default outputs" },
    { id: "plc.electrical", label: "Panel electrical calculations: motor full-load current, cable sizing with derating, power-factor correction" },
    { id: "plc.analog", label: "Analog signal scaling: 4-20 mA to engineering units and back" },
  ],
  unassessed: [
    { id: "plc.ladder", label: "Ladder diagram (or function-block) programming in a vendor editor" },
    { id: "plc.ide", label: "Vendor software: TIA Portal, CODESYS, Studio 5000, project download and online monitoring" },
    { id: "plc.io", label: "Real I/O: wiring, sensor and relay behaviour, scan-time and hardware timing" },
    { id: "plc.hmi", label: "HMI and SCADA screens, and industrial communications" },
    { id: "plc.safety", label: "Functional safety design and certification (SIL, safety relays and safety PLCs)" },
    { id: "plc.installation", label: "Installation design approval: the calculations are educational, not a compliance sign-off" },
  ],
  areas: [
    { areaKey: "plc-boolean-logic", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["plc.boolean", "plc.interlocks"] },
    { areaKey: "plc-timers-counters", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["plc.timers", "plc.counters"] },
    { areaKey: "plc-process-sequences", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["plc.sequences"] },
    { areaKey: "plc-fault-handling", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["plc.faults", "plc.boolean"] },
    { areaKey: "plc-electrical-calcs", toolType: "calc_workspace", generationVersion: "calc.gen.v1", gradingVersion: "calc.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["plc.electrical", "plc.analog"] },
  ],
  limitations: [
    "PLC logic is simulated. You write a pure scan-cycle function (inputs and state in, outputs and new state out) in your own browser; each scan of a scripted input sequence is checked as its own call with the reference state supplied, and the server compares what you submitted with its own answers. It never runs or reads your code, so the explain-your-work interview is the only check that you understand your solution.",
    "This is not TIA Portal, CODESYS or a ladder editor: ladder diagrams, function blocks, vendor software and online monitoring are not assessed.",
    "There is no real I/O, wiring, relay or sensor behaviour and no real scan time: a timer counts scans, not seconds. HMI, SCADA, communications and functional safety design or certification are not assessed.",
    "Electrical calculation tickets are educational formulas, stated in each ticket's reference sheet, checked against a numeric tolerance. They are not an installation design and carry no claim of approval under any wiring code.",
    "Tickets come only from fixed templates (no AI-written variants), so a student can meet the same ticket again.",
  ],
};
