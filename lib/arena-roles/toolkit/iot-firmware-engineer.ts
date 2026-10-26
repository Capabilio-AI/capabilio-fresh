import type { RoleToolkit } from "./types";

/** IOT-01 IoT Firmware Engineer. Two shared workstations (code and calculation) with this role's own areas; device logic is simulated, not run on hardware. */
export const TOOLKIT: RoleToolkit = {
  roleKey: "iot-firmware-engineer",
  roleId: "IOT-01",
  stream: "IoT",
  headline: "Write the device and telemetry logic a new firmware engineer is handed, and do the power and link arithmetic around it, on scripted inputs.",
  workstations: [
    {
      name: "Code Editor",
      mirrors: ["VS Code", "PlatformIO", "MQTT Explorer (message thinking)"],
      toolType: "code_workspace",
      tier: "S",
      runsIn: "browser",
      summary: "Write one Python or JavaScript function for the device or telemetry rule, run it on scripted inputs in your browser, and submit what it returned.",
    },
    {
      name: "Power and Link Calculator",
      mirrors: ["Spreadsheet", "Nordic Power Profiler (concepts)", "Link budget calculators"],
      toolType: "calc_workspace",
      tier: "S",
      runsIn: "server",
      summary: "Work out battery life, link margin or data volume from the ticket's numbers; the server checks each result within a tolerance.",
    },
  ],
  environment: [
    { label: "Runtimes", detail: "Python (Pyodide) and JavaScript run in your browser for code tickets; nothing has to be installed." },
    { label: "Scripted inputs", detail: "Every code ticket comes with example inputs: readings, MQTT events, Modbus hex frames, version strings and rollout stages." },
    { label: "Formula sheet", detail: "Each calculation ticket lists the formulas it expects (average current, free-space path loss, bytes per message)." },
    { label: "Fictional company", detail: "Sankalp Agro Sensors, a made-up maker of pump controllers and soil and water sensors." },
  ],
  firstWeek: [
    "Build the telemetry message a pump controller publishes",
    "Reject bad sensor payloads before they reach the database",
    "Fix the offline buffer that keeps the oldest readings",
    "Decide what the broker does with each publish and disconnect",
    "Read the registers out of a Modbus RTU reply",
    "Tell which firmware version is newer and who gets the staged update",
    "Estimate how long the soil sensor battery lasts",
  ],
  portfolioArtifacts: [
    "Graded code tickets with per-case results, the code kept for the explain-your-work interview",
    "Graded calculation tickets with the per-result checks that passed",
  ],
  honestLimits: [
    "Device logic is simulated: code runs in your browser (client-run) on scripted inputs, and the server compares the outputs you submit; it never runs or reads your code.",
    "There is no real MQTT broker, device, sensor, radio or cloud; MQTT and Modbus are assessed as pure decisions and frame parsing.",
    "OTA is assessed as version, rollout and rollback logic only; nothing is flashed to hardware.",
    "Device provisioning, a real MQTT broker, OTA on hardware and security hardening are not assessed yet.",
    "Power and link numbers use textbook models and ignore self-discharge, temperature, fading and obstacles.",
  ],
};
