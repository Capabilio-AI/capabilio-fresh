import type { Rng } from "../rng";
import type { ExperienceLevel } from "../level";
import type { Difficulty } from "@/lib/arena-workstations/types";
import type { CodeDraft, CodeProblem, Lang } from "../code/problems";

// mirrors EXAMPLE_COUNT and MAX_SUBMISSIONS in ../code/problems.ts; imported as values that would make a cycle once code.ts lists these problems
const EXAMPLES = 2;
const SUBMISSIONS = 8;

/**
 * IoT Firmware Engineer tickets for the shared code workstation. They are the device and telemetry LOGIC a firmware fresher writes first: payloads,
 * sampling and buffering, MQTT/Modbus decisions, version and rollout rules. The student's function runs in their browser on scripted inputs and the
 * server compares the outputs with the answers below; no broker, device, radio or cloud is involved.
 */
interface Spec {
  id: string;
  area: string;
  difficulty: Difficulty;
  minLevel: ExperienceLevel;
  fn: string;
  params: string[];
  title: string;
  requester: CodeDraft["requester"];
  scenario: string;
  deliverable: string;
  tags: string[];
  cases(rng: Rng): unknown[][];
  solve(...args: never[]): unknown;
  broken?: Record<Lang, string>;
}

const CAST = {
  fleet: { name: "Kavya Menon", title: "Fleet Operations Lead" },
  firmware: { name: "Arvind Nair", title: "Firmware Lead" },
  backend: { name: "Sana Qureshi", title: "Cloud Backend Engineer" },
  field: { name: "Rohit Deshmukh", title: "Field Deployment Engineer" },
};

const starter = (fn: string, params: string[]): Record<Lang, string> => ({
  python: `def ${fn}(${params.join(", ")}):\n    # write your solution here\n    pass\n`,
  javascript: `function ${fn}(${params.join(", ")}) {\n  // write your solution here\n}\n`,
});

function problem(s: Spec): CodeProblem & { solve: Spec["solve"] } {
  return {
    id: s.id, areas: [s.area], difficulty: s.difficulty, minLevel: s.minLevel, solve: s.solve,
    build(rng) {
      const cases = s.cases(rng);
      const expected = cases.map((c) => (s.solve as (...a: unknown[]) => unknown)(...c));
      return {
        title: s.title, requester: s.requester, scenario: s.scenario, skillTags: s.tags,
        content: {
          fn: s.fn, params: s.params, cases,
          examples: cases.slice(0, EXAMPLES).map((args, i) => ({ args, expected: expected[i] })),
          starters: s.broken ?? starter(s.fn, s.params),
          deliverable: s.deliverable, maxSubmissions: SUBMISSIONS, timeLimitSeconds: 20,
        },
        key: { expected },
      };
    },
  };
}

const round1 = (x: number) => Math.round(x * 10) / 10;

// ---- iot-telemetry-payloads ----
type Reading = { sensor: string; value: number | null; unit: string };
const buildMessage = (site: string, deviceId: string, ts: number, readings: Reading[]) => {
  const slug = (s: string) => s.trim().toLowerCase().replace(/\s+/g, "-");
  const values: Record<string, number> = {};
  for (const r of readings) {
    if (r.value === null) continue;
    values[r.sensor] = r.unit === "F" ? round1(((r.value - 32) * 5) / 9) : r.value;
  }
  return { topic: `sankalp/${slug(site)}/${slug(deviceId)}/telemetry`, payload: { ts, device: deviceId, values } };
};
const readingsCase = (rng: Rng): Reading[] =>
  Array.from({ length: rng.int(1, 4) }, (_, i) => {
    const sensor = ["soil_moisture", "air_temp", "tank_level", "pump_amps"][i];
    return rng.pick<Reading>([
      { sensor, value: rng.int(10, 90), unit: "pct" },
      { sensor, value: rng.int(60, 110), unit: "F" },
      { sensor, value: null, unit: "pct" },
      { sensor, value: rng.int(1, 30), unit: "A" },
    ]);
  });

const parsePayload = (raw: string) => {
  let data: unknown;
  try { data = JSON.parse(raw); } catch { return { ok: false, error: "bad_json" }; }
  if (typeof data !== "object" || data === null || Array.isArray(data)) return { ok: false, error: "bad_json" };
  const d = data as Record<string, unknown>;
  if (!("t" in d) || !("h" in d)) return { ok: false, error: "missing_field" };
  if (typeof d.t !== "number" || typeof d.h !== "number") return { ok: false, error: "bad_type" };
  if (d.t < -40 || d.t > 85 || d.h < 0 || d.h > 100) return { ok: false, error: "out_of_range" };
  return { ok: true, t: d.t, h: d.h };
};
const payloadCase = (rng: Rng) =>
  rng.pick([
    `{"t": ${rng.int(-10, 60)}, "h": ${rng.int(0, 100)}}`, `{"t": ${rng.int(86, 120)}, "h": 50}`, `{"t": 25.5, "h": ${rng.int(101, 140)}}`, `{"t": "27", "h": 40}`,
    `{"h": 40}`, `{"t": 20`, `[1, 2]`, `{"t": null, "h": 30}`, `{"t": -40, "h": 100, "bat": 3.1}`,
  ]);

// ---- iot-device-logic ----
const batchReadings = (readings: { ts: number; value: number }[], maxSize: number) => {
  const seen = new Set<number>();
  const unique = readings.filter((r) => (seen.has(r.ts) ? false : (seen.add(r.ts), true))).sort((a, b) => a.ts - b.ts);
  const batches: { ts: number; value: number }[][] = [];
  for (let i = 0; i < unique.length; i += maxSize) batches.push(unique.slice(i, i + maxSize));
  return batches;
};
const tsReadings = (rng: Rng) => Array.from({ length: rng.int(0, 9) }, () => ({ ts: 1000 + rng.int(0, 7) * 60, value: rng.int(0, 99) }));

const backoffDelays = (n: number, baseMs: number, capMs: number) => Array.from({ length: n }, (_, i) => Math.min(capMs, baseMs * 2 ** i));

type BufEvent = { type: "reading"; v: number } | { type: "flush" };
const offlineBuffer = (events: BufEvent[], cap: number) => {
  let buffered: number[] = [];
  let sent: number[] = [];
  let dropped = 0;
  for (const e of events) {
    if (e.type === "reading") {
      buffered = [...buffered, e.v];
      if (buffered.length > cap) { buffered = buffered.slice(1); dropped++; }
    } else {
      sent = [...sent, ...buffered];
      buffered = [];
    }
  }
  return { sent, buffered, dropped };
};
const bufEvents = (rng: Rng, overflow: boolean): BufEvent[] =>
  Array.from({ length: rng.int(overflow ? 6 : 2, overflow ? 12 : 3) }, (_, i) => (rng.chance(overflow ? 0.1 : 0.2) && i > 1 ? { type: "flush" } : { type: "reading", v: rng.int(0, 99) }));

// ---- iot-protocol-handling ----
type MqttEvent = { kind: "publish"; pub_qos: number; sub_qos: number; retain: boolean } | { kind: "disconnect"; reason: string; will: string | null };
const mqttDecide = (events: MqttEvent[]) =>
  events.map((e) => (e.kind === "publish" ? { qos: Math.min(e.pub_qos, e.sub_qos), store_retained: e.retain } : { will_sent: e.reason !== "clean" && e.will !== null }));
const mqttEvents = (rng: Rng): MqttEvent[] =>
  Array.from({ length: rng.int(3, 7) }, () =>
    rng.chance(0.65)
      ? { kind: "publish", pub_qos: rng.int(0, 2), sub_qos: rng.int(0, 2), retain: rng.chance(0.4) }
      : { kind: "disconnect", reason: rng.pick(["clean", "keepalive_timeout", "network_error"]), will: rng.pick([null, "offline"]) });

const topicMatches = (filter: string, topic: string) => {
  const f = filter.split("/");
  const t = topic.split("/");
  if (topic.startsWith("$") && (f[0] === "#" || f[0] === "+")) return false;
  for (let i = 0; i < f.length; i++) {
    if (f[i] === "#") return i === f.length - 1;
    if (i >= t.length) return false;
    if (f[i] !== "+" && f[i] !== t[i]) return false;
  }
  return f.length === t.length;
};
const FILTERS = ["sankalp/+/pump-1/telemetry", "sankalp/#", "sankalp/farm-2/+/status", "+/farm-2/#", "#", "sankalp/farm-2/pump-1", "sankalp/farm-2/#"];
const TOPICS = ["sankalp/farm-2/pump-1/telemetry", "sankalp/farm-2/pump-1", "sankalp/farm-2", "sankalp", "sankalp/farm-2/gate-3/status", "$SYS/broker/uptime", "other/farm-2/x"];

const crc16 = (bytes: number[]) => {
  let crc = 0xffff;
  for (const b of bytes) {
    crc ^= b;
    for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >> 1) ^ 0xa001 : crc >> 1;
  }
  return crc;
};
const hex = (bytes: number[]) => bytes.map((b) => b.toString(16).padStart(2, "0")).join(" ");
const withCrc = (body: number[]) => [...body, crc16(body) & 0xff, crc16(body) >> 8];
const parseModbus = (frame: string) => {
  const bytes = frame.trim().split(/\s+/).filter(Boolean).map((h) => parseInt(h, 16));
  if (bytes.length < 5 || bytes.some((b) => Number.isNaN(b))) return { ok: false, error: "too_short" };
  const crc = crc16(bytes.slice(0, -2));
  if ((crc & 0xff) !== bytes[bytes.length - 2] || crc >> 8 !== bytes[bytes.length - 1]) return { ok: false, error: "bad_crc" };
  const [slave, fn] = bytes;
  if (fn & 0x80) return { ok: false, error: "exception", code: bytes[2] };
  if (fn !== 3 && fn !== 4) return { ok: false, error: "unsupported_function" };
  const count = bytes[2];
  if (count % 2 !== 0 || count !== bytes.length - 5) return { ok: false, error: "bad_length" };
  const registers: number[] = [];
  for (let i = 0; i < count; i += 2) registers.push(bytes[3 + i] * 256 + bytes[4 + i]);
  return { ok: true, slave, registers };
};
const modbusFrame = (rng: Rng) => {
  const slave = rng.int(1, 10);
  const regs = Array.from({ length: rng.int(1, 4) }, () => rng.int(0, 65535));
  const data = regs.flatMap((r) => [r >> 8, r & 0xff]);
  const good = withCrc([slave, rng.pick([3, 4]), data.length, ...data]);
  return rng.weighted<string>([
    [hex(good), 35], [hex(good.map((b, i) => (i === 3 ? b ^ 1 : b))), 15], [hex(withCrc([slave, 0x83, rng.int(1, 4)])), 15],
    [hex(withCrc([slave, 3, data.length + 2, ...data])), 10], [hex(withCrc([slave, 6, 0, 1, 0, 5])), 10], [hex(good.slice(0, 3)), 5],
  ]);
};

// ---- iot-ota-and-versions ----
const semverCompare = (a: string, b: string) => {
  const parse = (v: string) => {
    const [core, pre = ""] = v.replace(/^v/, "").split("-");
    return { n: core.split(".").map(Number), pre };
  };
  const x = parse(a);
  const y = parse(b);
  for (let i = 0; i < 3; i++) if (x.n[i] !== y.n[i]) return x.n[i] < y.n[i] ? -1 : 1;
  if (x.pre === y.pre) return 0;
  if (x.pre === "") return 1;
  if (y.pre === "") return -1;
  return x.pre < y.pre ? -1 : 1;
};
const version = (rng: Rng) => `${rng.pick(["", "v"])}${rng.int(0, 2)}.${rng.pick([0, 2, 9, 10])}.${rng.int(0, 11)}${rng.pick(["", "", "-rc1", "-rc2", "-beta"])}`;

const rolloutBuckets = (deviceIds: string[], percent: number) =>
  deviceIds.map((id) => {
    const bucket = [...id].reduce((s, c) => s + c.charCodeAt(0), 0) % 100;
    return { id, bucket, in_rollout: bucket < percent };
  });
const deviceIds = (rng: Rng) => Array.from({ length: rng.int(2, 6) }, () => `SNK-${rng.int(100, 999)}${rng.pick(["A", "B", "C"])}`);

type Stage = { devices: number; failed: number };
const rollbackDecision = (stages: Stage[]) => {
  for (let i = 0; i < stages.length; i++) {
    const { devices, failed } = stages[i];
    if (devices === 0) continue;
    if (failed * 100 >= devices * 5) return { action: "rollback", stage: i };
    if (failed * 100 >= devices * 2) return { action: "pause", stage: i };
  }
  return { action: "continue", stage: stages.length - 1 };
};
const stagesCase = (rng: Rng): Stage[] => {
  const sizes = [10, 100, 500, 2000];
  return Array.from({ length: rng.int(1, 4) }, (_, i) => ({ devices: rng.chance(0.08) ? 0 : sizes[i], failed: rng.pick([0, 0, 0, 1, 2, 3, 12, 40]) % (sizes[i] + 1) }));
};

export const IOT_CODE_PROBLEMS = [
  problem({
    id: "iot-build-message", area: "iot-telemetry-payloads", difficulty: "easy", minLevel: "fresher", fn: "build_message", params: ["site", "device_id", "ts", "readings"], requester: CAST.backend,
    title: "Build the telemetry message a pump controller publishes",
    scenario: "Hi, the cloud side expects every controller at Sankalp Agro Sensors to publish the same shape: one topic per device and one small JSON payload. Some firmware builds send Fahrenheit and some send null for a dead sensor, which breaks our dashboards.",
    deliverable: "Write build_message(site, device_id, ts, readings). readings is a list of {sensor, value, unit}. Return {topic, payload}. topic is \"sankalp/<site>/<device>/telemetry\" where site and device_id are trimmed, lower-cased, and have every run of spaces replaced by one hyphen. payload is {ts, device: device_id (unchanged), values}: values maps each sensor name to its value, skipping readings whose value is null; a reading in unit \"F\" is converted to Celsius with (v - 32) * 5 / 9 and rounded to 1 decimal; every other unit is kept as it is.",
    tags: ["Telemetry", "JSON", "Topic naming", "Units"],
    cases: (rng) => [["Farm 2", "Pump 1", 1700000000, [{ sensor: "soil_moisture", value: 42, unit: "pct" }]], [" North Block ", "GATE-3", 1700000060, [{ sensor: "air_temp", value: 86, unit: "F" }, { sensor: "tank_level", value: null, unit: "pct" }]], ["farm", "p", 5, []], ...Array.from({ length: 7 }, () => [rng.pick(["Farm 2", " Hill  Top ", "farm-7", "Canal Side"]), rng.pick(["Pump 1", "gate-3", " Valve  A "]), 1700000000 + rng.int(0, 9) * 60, readingsCase(rng)])],
    solve: buildMessage as never,
  }),
  problem({
    id: "iot-parse-payload", area: "iot-telemetry-payloads", difficulty: "medium", minLevel: "fresher", fn: "parse_payload", params: ["raw"], requester: CAST.backend,
    title: "Reject bad sensor payloads before they reach the database",
    scenario: "Hello, devices in the field send truncated JSON, strings instead of numbers and impossible readings, and each of them has crashed our ingest job at least once. We need one parser that either returns clean numbers or says exactly what is wrong.",
    deliverable: "Write parse_payload(raw). raw is the text of a message. Return {ok: false, error} with the first problem found, checked in this order: \"bad_json\" (the text is not valid JSON, or is valid JSON but not an object), \"missing_field\" (no t or no h key), \"bad_type\" (t or h is not a number; null counts as not a number), \"out_of_range\" (t outside -40 to 85, or h outside 0 to 100; the limits themselves are allowed). Otherwise return {ok: true, t, h}. Other keys are ignored.",
    tags: ["Telemetry", "JSON", "Validation"],
    cases: (rng) => [['{"t": 25, "h": 60}'], ['{"t": 25'], ['{"h": 60}'], ['{"t": "25", "h": 60}'], ['{"t": 90, "h": 60}'], ...Array.from({ length: 6 }, () => [payloadCase(rng)])],
    solve: parsePayload as never,
  }),
  problem({
    id: "iot-batch-readings", area: "iot-device-logic", difficulty: "easy", minLevel: "fresher", fn: "batch_readings", params: ["readings", "max_size"], requester: CAST.fleet,
    title: "Group queued readings into uploads of a fixed size",
    scenario: "Hi, our controllers wake up, send everything they queued in one radio session and go back to sleep. Sending one reading per message drains the battery, so we group them, but the queue sometimes holds the same timestamp twice after a retry.",
    deliverable: "Write batch_readings(readings, max_size). readings is a list of {ts, value}. Keep only the first reading seen for each ts, sort the rest by ts from oldest to newest, then split them into batches of at most max_size readings, in order. Return the list of batches. No readings gives an empty list.",
    tags: ["Batching", "Lists", "Sorting"],
    cases: (rng) => [[[{ ts: 1060, value: 5 }, { ts: 1000, value: 3 }, { ts: 1060, value: 9 }], 2], [[], 3], [[{ ts: 1000, value: 1 }], 5], ...Array.from({ length: 6 }, () => [tsReadings(rng), rng.int(1, 4)])],
    solve: batchReadings as never,
  }),
  problem({
    id: "iot-backoff-delays", area: "iot-device-logic", difficulty: "easy", minLevel: "fresher", fn: "backoff_delays", params: ["n", "base_ms", "cap_ms"], requester: CAST.firmware,
    title: "Work out the wait between reconnect attempts",
    scenario: "Hello, when the mobile network drops, every controller in a village retries at the same moment and the gateway collapses. We agreed on exponential backoff, but I need the exact schedule written down as a function so field and cloud teams agree.",
    deliverable: "Write backoff_delays(n, base_ms, cap_ms). Return a list of n waits in milliseconds: the wait before attempt number i (starting at 0) is base_ms doubled i times, but never more than cap_ms. n of 0 gives an empty list.",
    tags: ["Retry", "Backoff", "Lists"],
    cases: (rng) => [[5, 500, 60000], [0, 500, 60000], [8, 1000, 10000], [1, 250, 100], ...Array.from({ length: 6 }, () => [rng.int(1, 12), rng.pick([100, 250, 500, 1000]), rng.pick([1000, 5000, 30000])])],
    solve: backoffDelays as never,
  }),
  problem({
    id: "iot-debug-offline-buffer", area: "iot-device-logic", difficulty: "medium", minLevel: "fresher", fn: "offline_buffer", params: ["events", "cap"], requester: CAST.field,
    title: "Fix: the offline buffer keeps the oldest readings and loses the newest",
    scenario: "Hi, a pump station was offline for two days and when the link came back the dashboard showed the first hours only and nothing from the last day. The buffer below holds a limited number of readings while offline and is supposed to keep the latest ones. Please fix it.",
    deliverable: "Fix offline_buffer(events, cap). events are applied in order. {type: \"reading\", v} adds v to the buffer; if the buffer then holds more than cap readings, the OLDEST one is discarded and dropped goes up by 1. {type: \"flush\"} sends everything in the buffer, oldest first, and empties it. Return {sent, buffered, dropped}: sent is every value sent by all flushes in order, buffered is what is still waiting (oldest first) and dropped is the number of discarded readings.",
    tags: ["Offline buffer", "Debugging", "Queues"],
    cases: (rng) => [[[{ type: "reading", v: 1 }, { type: "reading", v: 2 }, { type: "flush" }], 3], [[{ type: "reading", v: 1 }, { type: "reading", v: 2 }, { type: "reading", v: 3 }, { type: "reading", v: 4 }], 2], [[{ type: "flush" }], 2], ...Array.from({ length: 3 }, () => [bufEvents(rng, false), rng.int(3, 5)]), ...Array.from({ length: 4 }, () => [bufEvents(rng, true), rng.int(1, 3)])],
    solve: offlineBuffer as never,
    broken: {
      python: "def offline_buffer(events, cap):\n    buffered, sent, dropped = [], [], 0\n    for e in events:\n        if e[\"type\"] == \"reading\":\n            if len(buffered) >= cap:\n                dropped += 1\n                continue\n            buffered.append(e[\"v\"])\n        else:\n            sent.extend(buffered)\n            buffered = []\n    return {\"sent\": sent, \"buffered\": buffered, \"dropped\": dropped}\n",
      javascript: "function offline_buffer(events, cap) {\n  let buffered = [];\n  const sent = [];\n  let dropped = 0;\n  for (const e of events) {\n    if (e.type === \"reading\") {\n      if (buffered.length >= cap) {\n        dropped += 1;\n        continue;\n      }\n      buffered.push(e.v);\n    } else {\n      sent.push(...buffered);\n      buffered = [];\n    }\n  }\n  return { sent, buffered, dropped };\n}\n",
    },
  }),
  problem({
    id: "iot-mqtt-decide", area: "iot-protocol-handling", difficulty: "easy", minLevel: "fresher", fn: "mqtt_decide", params: ["events"], requester: CAST.backend,
    title: "Decide what the broker does with each publish and disconnect",
    scenario: "Hi, new joiners keep mixing up QoS levels, retained messages and last-will messages, and we ship wrong assumptions into the firmware. Please write the broker's decisions as a small function we can use as the team's reference.",
    deliverable: "Write mqtt_decide(events). For each event, in order, return one result. A publish event {kind: \"publish\", pub_qos, sub_qos, retain} is delivered at the lower of the two QoS levels and stored as the retained message only if retain is true: return {qos, store_retained: retain}. A disconnect event {kind: \"disconnect\", reason, will} sends the client's last-will message only when the disconnect was not clean (reason is not \"clean\") and a will is set (will is not null): return {will_sent: true or false}.",
    tags: ["MQTT", "QoS", "Last will", "Retained"],
    cases: (rng) => [[[{ kind: "publish", pub_qos: 2, sub_qos: 1, retain: true }, { kind: "disconnect", reason: "clean", will: "offline" }]], [[{ kind: "disconnect", reason: "keepalive_timeout", will: "offline" }, { kind: "disconnect", reason: "network_error", will: null }]], [[]], ...Array.from({ length: 7 }, () => [mqttEvents(rng)])],
    solve: mqttDecide as never,
  }),
  problem({
    id: "iot-topic-matches", area: "iot-protocol-handling", difficulty: "medium", minLevel: "fresher", fn: "topic_matches", params: ["topic_filter", "topic"], requester: CAST.firmware,
    title: "Match a topic against a subscription filter with wildcards",
    scenario: "Hello, the gateway subscribes with filters such as sankalp/+/pump-1/telemetry, and our own routing code has to agree with the broker about what a filter matches. Today it does not, and alerts go to the wrong queue.",
    deliverable: "Write topic_matches(topic_filter, topic) returning true or false using MQTT rules. Levels are separated by /. A + in the filter matches exactly one level. A # is only valid as the last level of the filter and matches any number of remaining levels, including none (so sankalp/# matches sankalp). All other levels must be equal, and without wildcards both must have the same number of levels. A topic starting with $ is never matched by a filter whose first level is + or #.",
    tags: ["MQTT", "Wildcards", "Topics"],
    cases: (rng) => [["sankalp/+/pump-1/telemetry", "sankalp/farm-2/pump-1/telemetry"], ["sankalp/#", "sankalp"], ["#", "$SYS/broker/uptime"], ["sankalp/farm-2/pump-1", "sankalp/farm-2"], ...Array.from({ length: 7 }, () => [rng.pick(FILTERS), rng.pick(TOPICS)])],
    solve: topicMatches as never,
  }),
  problem({
    id: "iot-parse-modbus", area: "iot-protocol-handling", difficulty: "medium", minLevel: "fresher", fn: "parse_modbus", params: ["frame"], requester: CAST.field,
    title: "Read the registers out of a Modbus RTU reply",
    scenario: "Hi, our controllers read energy meters over a Modbus RTU cable and log each reply as hex text. Some replies are corrupted by noise and some are error replies, and the log parser treats them all as numbers.",
    deliverable: "Write parse_modbus(frame). frame is hex bytes separated by spaces, like \"01 03 02 00 0a 38 43\". Return {ok: false, error} for the first problem, in this order: \"too_short\" (fewer than 5 bytes or not valid hex), \"bad_crc\" (the last two bytes are not the Modbus CRC-16 of all earlier bytes, low byte first; CRC-16/MODBUS uses start value 0xFFFF and polynomial 0xA001, reflected), then if the function byte has its top bit set return {ok: false, error: \"exception\", code: the third byte}, \"unsupported_function\" (function is not 3 or 4), \"bad_length\" (the byte count in the third byte is odd or does not equal the number of data bytes). Otherwise return {ok: true, slave: first byte, registers: list of 16-bit big-endian values from the data bytes}.",
    tags: ["Modbus", "Frame parsing", "CRC", "Bytes"],
    cases: (rng) => [["01 03 02 00 0a 38 43"], ["01 03 02 00 0a 38 44"], ["01"], ["02 83 02 30 f1"], ...Array.from({ length: 6 }, () => [modbusFrame(rng)])],
    solve: parseModbus as never,
  }),
  problem({
    id: "iot-semver-compare", area: "iot-ota-and-versions", difficulty: "easy", minLevel: "fresher", fn: "semver_compare", params: ["a", "b"], requester: CAST.firmware,
    title: "Tell which firmware version is newer",
    scenario: "Hello, the update server compares firmware versions as plain text, so it thinks 1.9.3 is newer than 1.10.0 and never offers the update. Please write the comparison properly.",
    deliverable: "Write semver_compare(a, b) returning -1 if a is older than b, 1 if a is newer and 0 if they are the same version. A version is major.minor.patch, optionally with a leading v and optionally a pre-release suffix after a hyphen, like 1.4.0-rc1. Compare major, then minor, then patch as numbers. If those are equal, a version with a suffix is older than one without; if both have suffixes, compare the suffix text alphabetically.",
    tags: ["Versions", "OTA", "Comparison"],
    cases: (rng) => [["1.9.3", "1.10.0"], ["v2.0.0", "2.0.0"], ["1.4.0-rc1", "1.4.0"], ["1.4.0-rc1", "1.4.0-rc2"], ...Array.from({ length: 7 }, () => [version(rng), version(rng)])],
    solve: semverCompare as never,
  }),
  problem({
    id: "iot-rollout-bucket", area: "iot-ota-and-versions", difficulty: "easy", minLevel: "fresher", fn: "rollout_buckets", params: ["device_ids", "percent"], requester: CAST.fleet,
    title: "Pick which devices get the update in a staged rollout",
    scenario: "Hi, we push a new firmware to 10 percent of devices first. The choice has to be the same every time a device checks in, so we derive it from the device ID rather than a random number.",
    deliverable: "Write rollout_buckets(device_ids, percent). For each device ID, in order, compute bucket = the sum of the character codes of the ID, modulo 100. Return a list of {id, bucket, in_rollout} where in_rollout is true when bucket is below percent.",
    tags: ["OTA", "Staged rollout", "Hashing"],
    cases: (rng) => [[["SNK-101A", "SNK-202B"], 50], [["A"], 0], [["A"], 100], ...Array.from({ length: 6 }, () => [deviceIds(rng), rng.pick([10, 25, 50, 75])])],
    solve: rolloutBuckets as never,
  }),
  problem({
    id: "iot-rollback-decision", area: "iot-ota-and-versions", difficulty: "medium", minLevel: "fresher", fn: "rollback_decision", params: ["stages"], requester: CAST.fleet,
    title: "Decide whether to continue, pause or roll back an update",
    scenario: "Hello, we roll firmware out in stages of growing size and watch how many devices fail to boot or reconnect. Last month nobody stopped a bad build until stage three, so we want the rule written as code and applied the same way each time.",
    deliverable: "Write rollback_decision(stages). stages is a list of {devices, failed} in rollout order. Look at the stages in order and skip any stage with 0 devices. At the first stage where failed is at least 5 percent of devices, return {action: \"rollback\", stage: its 0-based position}. At the first stage where failed is at least 2 percent (but below 5), return {action: \"pause\", stage: its position}. If no stage triggers, return {action: \"continue\", stage: the position of the last stage} (-1 for an empty list). The earliest triggering stage wins, whichever action it gives.",
    tags: ["OTA", "Rollback", "Thresholds"],
    cases: (rng) => [[[{ devices: 10, failed: 0 }, { devices: 100, failed: 5 }]], [[{ devices: 10, failed: 0 }, { devices: 100, failed: 2 }, { devices: 500, failed: 40 }]], [[]], [[{ devices: 0, failed: 0 }, { devices: 100, failed: 1 }]], ...Array.from({ length: 6 }, () => [stagesCase(rng)])],
    solve: rollbackDecision as never,
  }),
];
