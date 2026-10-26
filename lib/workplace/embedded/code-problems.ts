import type { Rng } from "../rng";
import type { ExperienceLevel } from "../level";
import type { Difficulty } from "@/lib/arena-workstations/types";
import type { CodeDraft, CodeProblem, Lang } from "../code/problems";

// mirrors EXAMPLE_COUNT and MAX_SUBMISSIONS in ../code/problems.ts; imported as values that would make a cycle once code.ts lists these problems
const EXAMPLES = 2;
const SUBMISSIONS = 8;

/**
 * Embedded Systems tickets for the shared code workstation. Firmware LOGIC is simulated: each ticket is one pure function over a scripted trace
 * (button samples, ADC readings, ticks, bytes). The student's function runs in their browser and the server compares the pin/serial trace it
 * returned with the answers below. There is no MCU, register, interrupt or RTOS behind it.
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
  hw: { name: "Rohit Menon", title: "Hardware Lead" },
  fw: { name: "Sneha Pillai", title: "Firmware Lead" },
  field: { name: "Kabir Anand", title: "Field Test Engineer" },
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

const bits = (rng: Rng, n: number, pOne = 0.5) => Array.from({ length: n }, () => (rng.chance(pOne) ? 1 : 0));
const bytes = (rng: Rng, n: number) => Array.from({ length: n }, () => rng.int(0, 255));

// ---- emb-gpio-state-machines ----
const DEBOUNCE_TICKS = 3;
const debounce = (samples: number[]) => {
  let state = 0;
  let count = 0;
  return samples.map((s) => {
    if (s === state) count = 0;
    else if (++count === DEBOUNCE_TICKS) { state = s; count = 0; }
    return state;
  });
};
const noisyButton = (rng: Rng) => {
  const out: number[] = [];
  let level = 0;
  while (out.length < rng.int(14, 24)) {
    level = 1 - level;
    const run = rng.pick([1, 2, 2, 3, 4, 5, 6]);
    for (let i = 0; i < run; i++) out.push(level);
  }
  return out;
};

const ledModes = (buttons: number[]) => {
  const next: Record<string, string> = { off: "on", on: "blink", blink: "off" };
  let mode = "off";
  let inBlink = 0;
  let prev = 0;
  return buttons.map((b) => {
    if (b === 1 && prev === 0) { mode = next[mode]; inBlink = 0; }
    prev = b;
    if (mode === "off") return 0;
    if (mode === "on") return 1;
    return inBlink++ % 4 < 2 ? 1 : 0;
  });
};

// ---- emb-sensors-and-thresholds ----
const adcToTenths = (readings: number[]) => readings.map((r) => Math.floor((r * 3300) / 1024));

const thermostat = (readings: number[], low: number, high: number) => {
  let on = 0;
  return readings.map((t) => {
    if (t <= low) on = 1;
    else if (t >= high) on = 0;
    return on;
  });
};
const walk = (rng: Rng, n: number, lo: number, hi: number) => {
  let v = rng.int(lo, hi);
  return Array.from({ length: n }, () => (v = Math.min(hi, Math.max(lo, v + rng.int(-4, 4)))));
};

// ---- emb-serial-protocols ----
const START = 0xaa;
const MAX_PAYLOAD = 8;
const checksum = (len: number, payload: number[]) => payload.reduce((x, b) => x ^ b, len);
const buildFrame = (payload: number[]) => [START, payload.length, ...payload, checksum(payload.length, payload)];

const parseFrames = (stream: number[]) => {
  const out: number[][] = [];
  let i = 0;
  while (i < stream.length) {
    if (stream[i] !== START || i + 1 >= stream.length) { i++; continue; }
    const len = stream[i + 1];
    const end = i + 2 + len;
    if (len > MAX_PAYLOAD || end >= stream.length) { i++; continue; }
    const payload = stream.slice(i + 2, end);
    if (checksum(len, payload) === stream[end]) { out.push(payload); i = end + 1; } else i++;
  }
  return out;
};
const serialStream = (rng: Rng) => {
  const out: number[] = [];
  for (let f = rng.int(1, 4); f > 0; f--) {
    out.push(...bytes(rng, rng.int(0, 3)).filter((b) => b !== START));
    const frame = buildFrame(bytes(rng, rng.int(0, 5)));
    if (rng.chance(0.3)) frame[frame.length - 1] ^= 0x5a;
    out.push(...frame);
  }
  if (rng.chance(0.4)) out.push(START, 4, 1);
  return out;
};

// ---- emb-timing ----
const MILLIS_WRAP = 4294967296;
const elapsedMs = (start: number, now: number) => (now - start + MILLIS_WRAP) % MILLIS_WRAP;
const wrapPair = (rng: Rng): number[] => {
  const start = rng.chance(0.5) ? rng.int(0, 1_000_000) : MILLIS_WRAP - rng.int(1, 5000);
  const gap = rng.int(0, 9000);
  return [start, (start + gap) % MILLIS_WRAP];
};

const pwmLevels = (duty: number, period: number, ticks: number) => {
  const onTicks = Math.floor((period * duty) / 100);
  return Array.from({ length: ticks }, (_, t) => (t % period < onTicks ? 1 : 0));
};

export const EMBEDDED_CODE_PROBLEMS = [
  problem({
    id: "emb-debounce-button", area: "emb-gpio-state-machines", difficulty: "easy", minLevel: "fresher", fn: "debounce", params: ["samples"], requester: CAST.fw,
    title: "Debounce the door-sensor button",
    scenario: "Hi, the door sensor's contact bounces for a few milliseconds each time it closes, so the counter ticks up twice per door opening. The firmware samples the pin once per tick; I need the debouncing step, tested against a recorded trace before it goes on the board.",
    deliverable: "Write debounce(samples). samples is a list of raw pin readings (0 or 1), one per tick. The debounced output starts at 0. It changes to the other level only after 3 consecutive raw samples at that other level; any raw sample equal to the current output restarts that count. Return the debounced output after each tick, as a list the same length as samples.",
    tags: ["GPIO", "Debouncing", "State machines"],
    cases: (rng) => [[[0, 1, 1, 1, 1, 0, 0, 0, 0]], [[1, 0, 1, 0, 1, 0]], [[]], [[1, 1, 0, 1, 1, 1, 1]], ...Array.from({ length: 8 }, () => [noisyButton(rng)])],
    solve: debounce as never,
  }),
  problem({
    id: "emb-led-modes", area: "emb-gpio-state-machines", difficulty: "medium", minLevel: "fresher", fn: "led_modes", params: ["buttons"], requester: CAST.hw,
    title: "One button, three LED modes",
    scenario: "Hello, the torch prototype has one button and one LED. Each press should step the LED through off, steady on and blinking. We want the state machine proven against button traces before the PCB arrives.",
    deliverable: "Write led_modes(buttons). buttons is a list with the button level (1 = pressed) at each tick; the level before the first tick is 0. A press is a tick where the button is 1 and the previous tick was 0. The mode starts as off and each press moves it off, on, blink, off, on, ... In off the LED is 0 and in on it is 1. In blink the LED is 1 for 2 ticks then 0 for 2 ticks, repeating, counting from the tick of the press that entered blink (that tick is the first of the 2 high ticks). The new mode applies on the tick of the press. Return the LED level for each tick.",
    tags: ["GPIO", "Edge detection", "State machines"],
    cases: (rng) => [[[0, 1, 1, 0, 0, 1, 0, 1, 0, 0, 0, 0]], [[1, 1, 1, 1]], [[]], [[1, 0, 1, 0, 1, 0, 0, 0, 0, 0, 0, 0, 1]], ...Array.from({ length: 8 }, () => [bits(rng, rng.int(12, 26), 0.35)])],
    solve: ledModes as never,
  }),
  problem({
    id: "emb-adc-to-tenths", area: "emb-sensors-and-thresholds", difficulty: "easy", minLevel: "fresher", fn: "adc_to_tenths", params: ["readings"], requester: CAST.hw,
    title: "Convert the cold-room ADC readings to temperature",
    scenario: "Hi, the cold-room logger reads an LM35 sensor (10 mV per degree C) on a 10-bit ADC with a 3.3 V reference, and the raw counts are unreadable for the shop-floor team. The target MCU has no floating point, so the conversion must use whole numbers.",
    deliverable: "Write adc_to_tenths(readings). readings is a list of raw ADC counts from 0 to 1023 (10 bits, reference 3.3 V = 3300 mV). For each count, work out the voltage in whole millivolts, rounding down (counts × 3300 ÷ 1024, rounded down). Since the sensor gives 10 mV per degree C, that millivolt number is the temperature in tenths of a degree C. Return the list of temperatures in tenths of a degree.",
    tags: ["ADC", "Scaling", "Integer maths"],
    cases: (rng) => [[[0, 1023, 512]], [[310]], [[]], [[1, 2, 3, 4]], ...Array.from({ length: 8 }, () => [Array.from({ length: rng.int(2, 8) }, () => rng.int(0, 1023))])],
    solve: adcToTenths as never,
  }),
  problem({
    id: "emb-thermostat-hysteresis", area: "emb-sensors-and-thresholds", difficulty: "medium", minLevel: "fresher", fn: "thermostat", params: ["readings", "low", "high"], requester: CAST.field,
    title: "Stop the heater relay chattering",
    scenario: "Hello, in the incubator test the heater relay clicks on and off every few seconds when the temperature sits near the set point. We need hysteresis: switch on when it is clearly cold, off when clearly warm, and hold in between.",
    deliverable: "Write thermostat(readings, low, high) with low < high. readings are temperatures in tenths of a degree, one per tick. The heater starts off (0). At each tick: if the reading is at or below low the heater turns on (1); otherwise if the reading is at or above high it turns off (0); otherwise it keeps its previous state. Return the heater state after each tick.",
    tags: ["Hysteresis", "Thresholds", "Relay control"],
    cases: (rng) => [[[370, 365, 360, 355, 362, 368, 372, 375], 360, 370], [[400, 401], 360, 370], [[], 360, 370], [[300, 365, 365, 380, 365], 330, 370], ...Array.from({ length: 8 }, () => [walk(rng, rng.int(10, 20), 340, 390), 355, 370])],
    solve: thermostat as never,
  }),
  problem({
    id: "emb-build-frame", area: "emb-serial-protocols", difficulty: "easy", minLevel: "fresher", fn: "build_frame", params: ["payload"], requester: CAST.fw,
    title: "Build the UART frame for the sensor node",
    scenario: "Hi, the sensor node reports to the gateway over UART, and the gateway drops anything without the agreed framing. Please write the function that wraps a payload into a frame so we can test it against the gateway's parser.",
    deliverable: "Write build_frame(payload). payload is a list of bytes (whole numbers 0 to 255), possibly empty. The frame is: the start byte 170 (0xAA), then the payload length as one byte, then the payload bytes, then a checksum byte. The checksum is the XOR of the length byte and every payload byte. Return the whole frame as a list of bytes.",
    tags: ["UART", "Framing", "Checksum"],
    cases: (rng) => [[[1, 2, 3]], [[]], [[255]], [[170, 170]], ...Array.from({ length: 8 }, () => [bytes(rng, rng.int(0, 8))])],
    solve: buildFrame as never,
  }),
  problem({
    id: "emb-parse-frames", area: "emb-serial-protocols", difficulty: "medium", minLevel: "fresher", fn: "parse_frames", params: ["stream"], requester: CAST.hw,
    title: "Pull good frames out of a noisy serial stream",
    scenario: "Hello, on the long cable the gateway sees noise bytes between frames and the occasional corrupted frame. The parser must recover every good frame and never accept a bad one. Frames use the node's format: start byte 0xAA, length, payload, XOR checksum.",
    deliverable: "Write parse_frames(stream). stream is a list of received bytes. Scan from the first byte: a frame starts at a byte equal to 170 (0xAA). The next byte is the payload length (it must be at most 8), followed by that many payload bytes and then one checksum byte, which must equal the XOR of the length byte and all payload bytes. If the frame is valid, add its payload (a list) to the result and continue scanning after its checksum byte. If it is not valid (bad length, bad checksum, or the stream ends before the frame does), or the byte is not a start byte, move on by one byte and keep scanning. Return the list of payloads in order.",
    tags: ["UART", "Parsing", "Checksum", "Resynchronisation"],
    cases: (rng) => [[[170, 2, 7, 9, 12]], [[1, 2, 170, 0, 0, 255]], [[]], [[170, 2, 7, 9, 99, 170, 1, 5, 4]], ...Array.from({ length: 8 }, () => [serialStream(rng)])],
    solve: parseFrames as never,
  }),
  problem({
    id: "emb-debug-millis-elapsed", area: "emb-timing", difficulty: "easy", minLevel: "fresher", fn: "elapsed_ms", params: ["start", "now"], requester: CAST.field,
    title: "Fix: the watering timer misbehaves after 49 days",
    scenario: "Hi, the irrigation controller waters fine for weeks, then once its millisecond counter wraps back to 0 (a 32-bit counter, about every 49.7 days) the elapsed-time check goes negative and the valve stays shut. The helper below is the suspect.",
    deliverable: "Fix elapsed_ms(start, now) so it returns the number of milliseconds from start to now, where both are readings of a 32-bit millisecond counter (0 to 4294967295) that wraps to 0 after 4294967295. now may be numerically smaller than start when the counter wrapped in between; the result must still be the true elapsed time (never negative).",
    tags: ["Debugging", "Timers", "Rollover", "32-bit arithmetic"],
    cases: (rng) => [[1000, 1500], [4294967000, 200], [5, 5], [4294967295, 0], ...Array.from({ length: 8 }, () => wrapPair(rng))],
    solve: elapsedMs as never,
    broken: {
      python: "def elapsed_ms(start, now):\n    return now - start\n",
      javascript: "function elapsed_ms(start, now) {\n  return now - start;\n}\n",
    },
  }),
  problem({
    id: "emb-pwm-levels", area: "emb-timing", difficulty: "medium", minLevel: "fresher", fn: "pwm_levels", params: ["duty_percent", "period", "ticks"], requester: CAST.hw,
    title: "Dim the status LED with PWM",
    scenario: "Hello, the status LED is dimmed in software PWM from a timer tick. Before we trust the timer code on the board I want the output pattern for a given brightness written down as a trace we can compare against the logic analyser.",
    deliverable: "Write pwm_levels(duty_percent, period, ticks). duty_percent is a whole number from 0 to 100 and period is the PWM period in ticks. The pin is high for the first on_ticks ticks of every period, where on_ticks is period × duty_percent ÷ 100 rounded down, and low for the rest of the period. Return the pin level (1 or 0) for ticks 0 up to ticks - 1, as a list of length ticks.",
    tags: ["PWM", "Timers", "Duty cycle"],
    cases: (rng) => [[50, 4, 8], [0, 5, 7], [100, 5, 7], [25, 10, 12], ...Array.from({ length: 8 }, () => { const period = rng.int(3, 12); return [rng.int(0, 100), period, rng.int(period, period * 3)]; })],
    solve: pwmLevels as never,
  }),
];
