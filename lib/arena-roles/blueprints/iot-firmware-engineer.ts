import type { RoleBlueprint } from "../blueprint";

/**
 * IOT-01 IoT Firmware Engineer. Mirrors supabase/migrations/137_iot_firmware_engineer_role.sql (not applied).
 *
 * Wave 2 role, built honestly at the LOGIC tier: there is no device, broker, radio or cloud. Code tickets (payloads, sampling and buffering, MQTT and
 * Modbus decisions, versions and rollout rules) are one function the student runs in their browser on scripted inputs; the server compares the outputs.
 * Calculation tickets (battery life, link budget, data cost) are numbers checked against a computed key.
 */
export const IOT_FIRMWARE_ENGINEER: RoleBlueprint = {
  roleId: "IOT-01",
  domainRoleKey: "iot-firmware-engineer",
  name: "IoT Firmware Engineer",
  competencies: [
    { id: "iot.payloads", label: "Building and validating telemetry payloads, topics and units" },
    { id: "iot.device-logic", label: "Device logic: batching, offline buffering, retry and backoff" },
    { id: "iot.mqtt", label: "MQTT decisions: QoS, retained messages, last will, topic filters" },
    { id: "iot.frames", label: "Parsing binary protocol frames (Modbus RTU) with a checksum" },
    { id: "iot.ota", label: "Firmware versions, staged rollout and rollback decisions" },
    { id: "iot.power", label: "Power budget: average current and battery life from a duty cycle" },
    { id: "iot.link", label: "Link budget and data cost: path loss, margin, bytes per message" },
    { id: "iot.debugging", label: "Finding and fixing a defect from a failing case" },
  ],
  unassessed: [
    { id: "iot.broker", label: "A real MQTT broker: connections, sessions, TLS and delivery guarantees" },
    { id: "iot.provisioning", label: "Device provisioning, identity and certificates" },
    { id: "iot.ota-hardware", label: "OTA on hardware: flashing, bootloaders, partitions and power loss during an update" },
    { id: "iot.security", label: "Security hardening: secure boot, key storage and attack surface" },
    { id: "iot.hardware", label: "Real devices: sensors, interrupts, RTOS timing and a radio" },
  ],
  areas: [
    { areaKey: "iot-telemetry-payloads", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["iot.payloads"] },
    { areaKey: "iot-device-logic", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["iot.device-logic", "iot.debugging"] },
    { areaKey: "iot-protocol-handling", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["iot.mqtt", "iot.frames"] },
    { areaKey: "iot-ota-and-versions", toolType: "code_workspace", generationVersion: "code.gen.v1", gradingVersion: "code.grade.v1", executionMode: "client-run", status: "enabled", competencies: ["iot.ota"] },
    { areaKey: "iot-power-and-link-calcs", toolType: "calc_workspace", generationVersion: "calc.gen.v1", gradingVersion: "calc.grade.v1", executionMode: "computed-key", status: "enabled", competencies: ["iot.power", "iot.link"] },
  ],
  limitations: [
    "Device and telemetry LOGIC is simulated: the student's function runs in their own browser on scripted inputs and the server compares the outputs it is sent with its own answers; the code is never run or read by the server. The explain-your-work interview is the only check that the student understands their solution.",
    "There is no real MQTT broker, device, sensor, radio or cloud. MQTT and Modbus tickets assess decisions and frame parsing as pure functions, not a live connection or a serial bus.",
    "OTA tickets assess version comparison, rollout bucketing and the rollback rule as logic; nothing is flashed, no bootloader, partition or power loss is modelled.",
    "Power and link tickets use textbook models (time-weighted average current, free-space path loss, byte counts) and ignore self-discharge, temperature, fading and obstacles.",
    "Device provisioning, real MQTT broker work, OTA on hardware and security hardening are not assessed.",
    "Tickets come only from fixed templates with seeded numbers (no AI-written variants), so a student can meet the same ticket again.",
  ],
};
