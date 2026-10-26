import type { Rng } from "../rng";
import type { ExperienceLevel } from "../level";
import type { Difficulty } from "@/lib/arena-workstations/types";
import type { CodeDraft, CodeProblem, Lang } from "../code/problems";

// mirrors EXAMPLE_COUNT and MAX_SUBMISSIONS in ../code/problems.ts; imported as values that would make a cycle once code.ts lists these problems
const EXAMPLES = 2;
const SUBMISSIONS = 8;

/**
 * PLC tickets for the shared code workstation. PLC logic is SIMULATED: the student writes one pure scan-cycle function scan(inputs, state) that returns
 * {outputs, state}. A scripted input sequence is replayed one scan at a time: case k is [inputs_k, state_k] where state_k is what the reference left after
 * scan k-1, so each case is an independent call and the student's own earlier answers never feed the next one. The function runs in their browser; the
 * server compares what it returned with the answers below (lib/arena-workstations/tools/code.ts). Not TIA Portal/CODESYS and no real I/O or scan time.
 */
type Io = Record<string, boolean | number | string>;
type Step = (inputs: Io, state: Io) => { outputs: Io; state: Io };

interface Spec {
  id: string;
  area: string;
  difficulty: Difficulty;
  minLevel: ExperienceLevel;
  title: string;
  requester: CodeDraft["requester"];
  scenario: string;
  deliverable: string;
  tags: string[];
  init: Io;
  scans: number;
  /** the inputs of scan i; `state` is the state going into it and `memo` is scratch space for the build (a simulated tank level, a streak) */
  inputs(rng: Rng, i: number, state: Io, memo: Record<string, number>): Io;
  step: Step;
  broken?: Record<Lang, string>;
}

const CAST = {
  panel: { name: "Prakash Nair", title: "Control Panel Lead" },
  plant: { name: "Sunita Deshmukh", title: "Plant Engineer" },
  maint: { name: "Arvind Kulkarni", title: "Maintenance Supervisor" },
  commissioning: { name: "Meera Iyer", title: "Commissioning Engineer" },
};

const FN = "scan";
const PARAMS = ["inputs", "state"];

const starter: Record<Lang, string> = {
  python: `def ${FN}(${PARAMS.join(", ")}):\n    # return {"outputs": {...}, "state": {...}}\n    pass\n`,
  javascript: `function ${FN}(${PARAMS.join(", ")}) {\n  // return { outputs: {...}, state: {...} }\n}\n`,
};

function problem(s: Spec): CodeProblem & { step: Step } {
  return {
    id: s.id, areas: [s.area], difficulty: s.difficulty, minLevel: s.minLevel, step: s.step,
    build(rng) {
      const memo: Record<string, number> = {};
      const cases: unknown[][] = [];
      const expected: unknown[] = [];
      let state = s.init;
      for (let i = 0; i < s.scans; i++) {
        const inputs = s.inputs(rng, i, state, memo);
        const result = s.step(inputs, state);
        cases.push([inputs, state]);
        expected.push(result);
        state = result.state;
      }
      return {
        title: s.title, requester: s.requester, scenario: s.scenario, skillTags: s.tags,
        content: {
          fn: FN, params: PARAMS, cases,
          examples: cases.slice(0, EXAMPLES).map((args, i) => ({ args, expected: expected[i] })),
          starters: s.broken ?? starter,
          deliverable: s.deliverable, maxSubmissions: SUBMISSIONS, timeLimitSeconds: 20,
        },
        key: { expected },
      };
    },
  };
}

const HARNESS = " The harness calls scan once per scan with that scan's inputs and the state left by the previous scan (the first call gets the initial state shown in the examples); it never feeds your own output back, so each call must depend only on its two arguments. Do not change them.";

// ---- plc-boolean-logic ----
const sealIn: Step = (i, s) => {
  const run = !i.estop && !i.stop && (Boolean(i.start) || Boolean(s.run));
  return { outputs: { motor: run }, state: { run } };
};
const interlock: Step = (i, s) => {
  let dir = String(s.dir);
  if (i.estop || i.stop) dir = "none";
  else if (dir === "none") dir = i.fwd_btn && !i.rev_btn ? "fwd" : i.rev_btn && !i.fwd_btn ? "rev" : "none";
  return { outputs: { fwd: dir === "fwd", rev: dir === "rev" }, state: { dir } };
};

// ---- plc-timers-counters ----
const TON_PRESET = 5;
const ton: Step = (i, s) => {
  const acc = i.enable ? Math.min(Number(s.acc) + 1, TON_PRESET) : 0;
  return { outputs: { done: acc >= TON_PRESET }, state: { acc } };
};
const CTU_PRESET = 4;
const ctu: Step = (i, s) => {
  const count = i.reset ? 0 : Number(s.count) + (i.pulse && !s.prev ? 1 : 0);
  return { outputs: { count, done: count >= CTU_PRESET }, state: { count, prev: Boolean(i.pulse) } };
};

/** a boolean that keeps its value for a few scans: streaks long enough to reach a timer preset */
const streak = (rng: Rng, memo: Record<string, number>, i: number, flipChance: number, key = "on") => {
  if (i === 0) memo[key] = rng.chance(0.7) ? 1 : 0;
  else if (rng.chance(flipChance)) memo[key] = 1 - memo[key];
  return memo[key] === 1;
};

// ---- plc-process-sequences ----
const TANK_MAX = 10;
const tank: Step = (i, s) => {
  const pump = i.low ? true : i.high ? false : Boolean(s.pump);
  return { outputs: { pump }, state: { pump } };
};
const DWELL_SCANS = 3;
const conveyor: Step = (i, s) => {
  let step = String(s.step);
  let acc = Number(s.acc);
  if (i.estop) { step = "idle"; acc = 0; }
  else if (step === "idle" && i.start) step = "run";
  else if (step === "run" && i.part_at_end) { step = "dwell"; acc = 0; }
  else if (step === "dwell") { acc += 1; if (acc >= DWELL_SCANS) { step = "idle"; acc = 0; } }
  return { outputs: { conveyor: step === "run", clamp: step === "dwell" }, state: { step, acc } };
};
const LIGHT_SCANS: Record<string, number> = { green: 4, yellow: 2, red: 5 };
const LIGHT_NEXT: Record<string, string> = { green: "yellow", yellow: "red", red: "green" };
const trafficLight: Step = (i, s) => {
  let phase = String(s.phase);
  let acc = i.hold ? Number(s.acc) : Number(s.acc) + 1;
  if (acc >= LIGHT_SCANS[phase]) { phase = LIGHT_NEXT[phase]; acc = 0; }
  return { outputs: { green: phase === "green", yellow: phase === "yellow", red: phase === "red" }, state: { phase, acc } };
};

// ---- plc-fault-handling ----
const DEBOUNCE_SCANS = 3;
const debounce: Step = (i, s) => {
  const count = i.sensor ? Number(s.count) + 1 : 0;
  return { outputs: { fault: count >= DEBOUNCE_SCANS }, state: { count } };
};
const alarmLatch: Step = (i, s) => {
  const alarm = !i.sensor_ok || Boolean(i.pressure_high) || (Boolean(s.alarm) && !i.ack);
  return { outputs: { alarm, valve_open: !alarm }, state: { alarm } };
};
const estopLatch: Step = (i, s) => {
  const tripped = Boolean(i.estop) || (Boolean(s.tripped) && !i.reset);
  return { outputs: { run: !tripped }, state: { tripped } };
};

export const PLC_CODE_PROBLEMS = [
  problem({
    id: "plc-seal-in-start-stop", area: "plc-boolean-logic", difficulty: "easy", minLevel: "fresher", requester: CAST.panel, init: { run: false }, scans: 12, step: sealIn,
    title: "Write the start/stop seal-in for the pump motor",
    scenario: "Hi, the new transfer pump has a green START push-button, a red STOP push-button and a mushroom E-stop. The motor must keep running after START is released, and must drop out when STOP or the E-stop is pressed. Please write the logic as one scan.",
    deliverable: "Write scan(inputs, state). inputs is {start, stop, estop}, all booleans where true means pressed. state is {run} (the motor was running at the end of the previous scan). The motor runs this scan when neither stop nor estop is pressed and (start is pressed or it was already running). Return {outputs: {motor}, state: {run}} where motor and run both equal whether the motor runs this scan." + HARNESS,
    tags: ["Seal-in", "Start/stop", "E-stop"],
    inputs: (rng, i) => ({ start: i === 0 ? true : rng.chance(0.3), stop: rng.chance(0.15), estop: rng.chance(0.05) }),
  }),
  problem({
    id: "plc-fwd-rev-interlock", area: "plc-boolean-logic", difficulty: "medium", minLevel: "fresher", requester: CAST.plant, init: { dir: "none" }, scans: 14, step: interlock,
    title: "Interlock the conveyor's forward and reverse contactors",
    scenario: "Hello, the reversing conveyor has FWD and REV push-buttons plus STOP and E-stop. If both contactors ever close together the supply is shorted, so only one direction may run, and a direction in progress must not be hijacked by pressing the other button.",
    deliverable: "Write scan(inputs, state). inputs is {fwd_btn, rev_btn, stop, estop}, booleans where true means pressed. state is {dir}, one of \"none\", \"fwd\", \"rev\" (the direction at the end of the previous scan). If stop or estop is pressed, dir becomes \"none\". Otherwise, if dir is \"none\": it becomes \"fwd\" when only fwd_btn is pressed, \"rev\" when only rev_btn is pressed, and stays \"none\" when both or neither are pressed. If dir is already \"fwd\" or \"rev\" it stays as it is (the other button is ignored until stop). Return {outputs: {fwd, rev}, state: {dir}} where fwd is true only if the new dir is \"fwd\" and rev only if it is \"rev\"." + HARNESS,
    tags: ["Interlock", "State", "E-stop"],
    inputs: (rng) => ({ fwd_btn: rng.chance(0.35), rev_btn: rng.chance(0.35), stop: rng.chance(0.1), estop: rng.chance(0.04) }),
  }),
  problem({
    id: "plc-on-delay-timer", area: "plc-timers-counters", difficulty: "easy", minLevel: "fresher", requester: CAST.commissioning, init: { acc: 0 }, scans: 16, step: ton,
    title: "Build an on-delay timer for the warning horn",
    scenario: "Hi, the horn must sound only after the guard door has been open for five scans in a row, so a bounce does not set it off. Our PLC timers count scans here, so please write the on-delay (TON) as plain state.",
    deliverable: `Write scan(inputs, state). inputs is {enable} (boolean). state is {acc}, the number of scans enable has been continuously true. While enable is true, acc goes up by 1 each scan but never above ${TON_PRESET}; as soon as enable is false, acc goes back to 0. Return {outputs: {done}, state: {acc}} with the new acc, where done is true when the new acc is ${TON_PRESET}.` + HARNESS,
    tags: ["TON", "Timers", "State"],
    inputs: (rng, i, _s, memo) => ({ enable: streak(rng, memo, i, 0.12) }),
  }),
  problem({
    id: "plc-ctu-box-counter", area: "plc-timers-counters", difficulty: "medium", minLevel: "fresher", requester: CAST.plant, init: { count: 0, prev: false }, scans: 16, step: ctu,
    title: "Count the boxes passing the photo-eye",
    scenario: "Hello, a photo-eye pulses true while a box blocks the beam, and a box can block it for several scans. We count one box per rising edge, raise a 'batch full' output at four boxes, and the operator can reset the batch.",
    deliverable: `Write scan(inputs, state). inputs is {pulse, reset} (booleans). state is {count, prev}: the box count and the value of pulse in the previous scan (false at the start). If reset is true the count becomes 0; otherwise the count goes up by 1 only on a rising edge (pulse is true now and prev was false). Return {outputs: {count, done}, state: {count, prev}} where count is the new count, done is true when the new count is ${CTU_PRESET} or more, and the new prev is this scan's pulse (also while reset is true).` + HARNESS,
    tags: ["CTU", "Edge detection", "Counters"],
    inputs: (rng) => ({ pulse: rng.chance(0.55), reset: rng.chance(0.06) }),
  }),
  problem({
    id: "plc-tank-fill-pump", area: "plc-process-sequences", difficulty: "easy", minLevel: "fresher", requester: CAST.plant, init: { pump: false }, scans: 14, step: tank,
    title: "Keep the water tank between its low and high level switches",
    scenario: "Hi, the overhead tank has a LOW and a HIGH level switch. The fill pump should start when the level reaches LOW, keep filling until it reaches HIGH, and then stay off while the tank drains. Between the switches it must keep doing what it was doing, so it does not chatter.",
    deliverable: "Write scan(inputs, state). inputs is {low, high}: low is true while the water is at or below the LOW switch, high is true while it is at or above the HIGH switch. state is {pump} (was the pump on at the end of the previous scan). If low is true the pump is on; otherwise if high is true it is off; otherwise it keeps its previous value. Return {outputs: {pump}, state: {pump}}." + HARNESS,
    tags: ["Level control", "Hysteresis", "State"],
    inputs: (rng, i, state, memo) => {
      // a crude tank: the pump adds 2 per scan, the draw takes 1; the switches follow the level
      memo.level = i === 0 ? rng.int(1, 5) : Math.min(TANK_MAX, Math.max(0, memo.level + (state.pump ? 2 : -1)));
      return { low: memo.level <= 2, high: memo.level >= 8 };
    },
  }),
  problem({
    id: "plc-conveyor-stop-and-clamp", area: "plc-process-sequences", difficulty: "medium", minLevel: "fresher", requester: CAST.panel, init: { step: "idle", acc: 0 }, scans: 18, step: conveyor,
    title: "Sequence the conveyor: run, stop at the end, clamp, release",
    scenario: "Hello, on the packing line a part is carried to the end sensor, the conveyor stops, a clamp holds the part for three scans, then the clamp lets go and the line waits for the next START. An E-stop returns everything to idle at once.",
    deliverable: `Write scan(inputs, state). inputs is {start, part_at_end, estop} (booleans). state is {step, acc}: step is "idle", "run" or "dwell", and acc counts scans spent in "dwell". Work out the new step in this order: if estop is true, step becomes "idle" and acc 0. Else if step is "idle" and start is true, step becomes "run". Else if step is "run" and part_at_end is true, step becomes "dwell" and acc 0. Else if step is "dwell", acc goes up by 1 and when it reaches ${DWELL_SCANS} step becomes "idle" and acc 0. Only one of these happens per scan. Return {outputs: {conveyor, clamp}, state: {step, acc}} using the new values, where conveyor is true only in "run" and clamp only in "dwell".` + HARNESS,
    tags: ["State machine", "Sequencing", "E-stop"],
    inputs: (rng) => ({ start: rng.chance(0.25), part_at_end: rng.chance(0.3), estop: rng.chance(0.05) }),
  }),
  problem({
    id: "plc-traffic-light-phases", area: "plc-process-sequences", difficulty: "medium", minLevel: "fresher", requester: CAST.commissioning, init: { phase: "green", acc: 0 }, scans: 20, step: trafficLight,
    title: "Run the gate traffic light as a timed sequence",
    scenario: "Hi, the factory gate light cycles green, yellow, red and back. The guard has a HOLD switch that freezes the timing, for example while a truck is crossing. Each phase lasts a fixed number of scans.",
    deliverable: "Write scan(inputs, state). inputs is {hold} (boolean). state is {phase, acc}: phase is \"green\", \"yellow\" or \"red\" and acc is how many scans the phase has been timed. Each scan, acc goes up by 1 unless hold is true. If the new acc has reached the phase's length (green 4, yellow 2, red 5), the phase changes to the next one (green to yellow, yellow to red, red to green) and acc becomes 0. Return {outputs: {green, yellow, red}, state: {phase, acc}} with the new phase and acc, where exactly the output of the new phase is true." + HARNESS,
    tags: ["State machine", "Timers", "Sequencing"],
    inputs: (rng) => ({ hold: rng.chance(0.15) }),
  }),
  problem({
    id: "plc-debounce-fault", area: "plc-fault-handling", difficulty: "easy", minLevel: "fresher", requester: CAST.maint, init: { count: 0 }, scans: 14, step: debounce,
    title: "Stop the vibration sensor from tripping on a single spike",
    scenario: "Hello, the vibration switch on the fan blips for a scan or two when the belt slaps, and each blip trips the fan. Only a fault that stays on for three scans in a row should count.",
    deliverable: `Write scan(inputs, state). inputs is {sensor} (true while the sensor reports a fault). state is {count}, the number of scans in a row the sensor has been true. When sensor is true count goes up by 1, when it is false count goes back to 0. Return {outputs: {fault}, state: {count}} with the new count, where fault is true when the new count is ${DEBOUNCE_SCANS} or more.` + HARNESS,
    tags: ["Debounce", "Fault detection", "State"],
    inputs: (rng, i, _s, memo) => ({ sensor: streak(rng, memo, i, 0.3) }),
  }),
  problem({
    id: "plc-alarm-latch-failsafe", area: "plc-fault-handling", difficulty: "medium", minLevel: "fresher", requester: CAST.maint, init: { alarm: false }, scans: 14, step: alarmLatch,
    title: "Latch the pressure alarm and close the valve on any doubt",
    scenario: "Hi, on the compressor line a high-pressure alarm must stay on until the operator acknowledges it, and only if the pressure is back to normal. A broken sensor wire reads as 'sensor not OK' and must be treated as an alarm too. The feed valve is open only when there is no alarm, so any failure leaves it closed.",
    deliverable: "Write scan(inputs, state). inputs is {sensor_ok, pressure_high, ack} (booleans). state is {alarm} (the alarm at the end of the previous scan). The alarm is on this scan if sensor_ok is false, or pressure_high is true, or (it was on before and ack is false). Return {outputs: {alarm, valve_open}, state: {alarm}} where alarm is the new alarm and valve_open is true only when the new alarm is off." + HARNESS,
    tags: ["Alarm latch", "Acknowledge", "Fail-safe"],
    inputs: (rng) => ({ sensor_ok: rng.chance(0.9), pressure_high: rng.chance(0.2), ack: rng.chance(0.3) }),
  }),
  problem({
    id: "plc-debug-estop-latch", area: "plc-fault-handling", difficulty: "easy", minLevel: "fresher", requester: CAST.maint, init: { tripped: false }, scans: 12, step: estopLatch,
    title: "Fix: the pump restarts by itself when the E-stop is released",
    scenario: "Hello, after an E-stop the pump starts again the moment someone twists the mushroom button back out. Our rule is that the stop stays latched until the operator presses RESET. The logic below was written without the latch. Please fix it.",
    deliverable: "Fix scan(inputs, state). inputs is {estop, reset} (booleans, true means pressed). state is {tripped}. The stop is tripped this scan when estop is true, or when it was already tripped and reset is false. Return {outputs: {run}, state: {tripped}} where tripped is the new value and run is true only when it is not tripped." + HARNESS,
    tags: ["Debugging", "E-stop", "Latch"],
    inputs: (rng, i) => (i === 2 ? { estop: true, reset: false } : i === 3 ? { estop: false, reset: false } : { estop: rng.chance(0.1), reset: rng.chance(0.25) }),
    broken: {
      python: "def scan(inputs, state):\n    tripped = inputs[\"estop\"]\n    return {\"outputs\": {\"run\": not tripped}, \"state\": {\"tripped\": tripped}}\n",
      javascript: "function scan(inputs, state) {\n  const tripped = inputs.estop;\n  return { outputs: { run: !tripped }, state: { tripped } };\n}\n",
    },
  }),
];
