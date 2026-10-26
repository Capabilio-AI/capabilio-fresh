import type { CalcTemplate } from "./types";
import { relTol } from "./types";

/**
 * IoT power, link and data-cost tickets for the calc workstation. The student does the arithmetic by hand or with any tool; the server compares the numbers
 * with the key. These are textbook models (average current, free-space path loss, byte counts), not a measurement of a real battery or radio.
 */
const CAST = { fleet: { name: "Kavya Menon", title: "Fleet Operations Lead" }, hw: { name: "Dinesh Pillai", title: "Hardware Lead" }, ops: { name: "Sana Qureshi", title: "Cloud Backend Engineer" } };
const ABS_DB = 0.1;

export const IOT_CALC_TEMPLATES: CalcTemplate[] = [
  {
    id: "iot-battery-life",
    areas: ["iot-power-and-link-calcs"],
    difficulty: "easy",
    minLevel: "fresher",
    build(rng) {
      const capacity = rng.pick([1000, 2000, 2600, 3500]);
      const sleepUa = rng.pick([5, 10, 20]);
      const activeMa = rng.pick([40, 80, 120]);
      const activeS = rng.pick([2, 3, 5]);
      const cycleMin = rng.pick([10, 15, 30]);
      const cycleS = cycleMin * 60;
      const avgMa = (activeMa * activeS + (sleepUa / 1000) * (cycleS - activeS)) / cycleS;
      const days = capacity / avgMa / 24;
      return {
        title: "How long will the soil sensor battery last",
        requester: CAST.hw,
        scenario: "A soil sensor wakes up, reads and transmits, then sleeps until the next cycle. Field teams want to know how often they must replace the cell. Ignore self-discharge and temperature, and take the whole battery capacity as usable.",
        params: [
          { label: "Battery capacity", value: String(capacity), unit: "mAh" },
          { label: "Sleep current", value: String(sleepUa), unit: "uA" },
          { label: "Active current", value: String(activeMa), unit: "mA" },
          { label: "Active time per cycle", value: String(activeS), unit: "s" },
          { label: "Cycle length (wake to wake)", value: String(cycleMin), unit: "min" },
        ],
        fields: [
          { key: "avg_current", label: "Average current", unit: "mA", help: "Time-weighted average over one full cycle; sleep lasts the cycle minus the active time." },
          { key: "life_days", label: "Battery life", unit: "days" },
        ],
        key: { expected: { avg_current: avgMa, life_days: days }, tolerance: { avg_current: relTol(avgMa), life_days: relTol(days) } },
        reference: ["average current = (I_active x t_active + I_sleep x t_sleep) / cycle time", "1 mA = 1000 uA", "life (hours) = capacity (mAh) / average current (mA)"],
      };
    },
  },
  {
    id: "iot-payload-cost",
    areas: ["iot-power-and-link-calcs"],
    difficulty: "easy",
    minLevel: "fresher",
    build(rng) {
      const payload = rng.pick([24, 48, 64, 96]);
      const overhead = rng.pick([20, 28, 40]);
      const perHour = rng.pick([4, 6, 12, 30]);
      const perMessage = payload + overhead;
      const perDay = perMessage * perHour * 24;
      const mbMonth = (perDay * 30) / 1_000_000;
      return {
        title: "Estimate the monthly data use of one meter",
        requester: CAST.ops,
        scenario: "A water meter sends one message at a fixed interval over a metered SIM. Finance wants the data volume per device before ordering SIMs. Every message carries the same protocol overhead on top of its payload.",
        params: [
          { label: "Payload per message", value: String(payload), unit: "bytes" },
          { label: "Protocol overhead per message", value: String(overhead), unit: "bytes" },
          { label: "Messages per hour", value: String(perHour), unit: "msg/h" },
        ],
        fields: [
          { key: "per_message", label: "Bytes per message", unit: "bytes" },
          { key: "per_day", label: "Data per day", unit: "bytes" },
          { key: "mb_month", label: "Data per 30-day month", unit: "MB", help: "Use 1 MB = 1,000,000 bytes." },
        ],
        key: { expected: { per_message: perMessage, per_day: perDay, mb_month: mbMonth }, tolerance: { per_message: relTol(perMessage), per_day: relTol(perDay), mb_month: relTol(mbMonth) } },
        reference: ["bytes per message = payload + overhead", "per day = bytes per message x messages per hour x 24", "per month = per day x 30"],
      };
    },
  },
  {
    id: "iot-link-budget",
    areas: ["iot-power-and-link-calcs"],
    difficulty: "medium",
    minLevel: "fresher",
    build(rng) {
      const txDbm = rng.pick([10, 14, 20]);
      const txGain = rng.pick([0, 2]);
      const rxGain = rng.pick([2, 3, 5]);
      const freq = rng.pick([433, 868, 915]);
      const km = rng.pick([1, 2, 5, 10]);
      const sens = rng.pick([-120, -125, -130]);
      const fspl = 20 * Math.log10(km) + 20 * Math.log10(freq) + 32.44;
      const rx = txDbm + txGain + rxGain - fspl;
      const margin = rx - sens;
      return {
        title: "Check if the field node reaches the gateway",
        requester: CAST.hw,
        scenario: "A sub-GHz field node reports to a gateway across open farmland with a clear line of sight. Use free-space loss only; the real site will add trees, walls and fading, so the margin you find is the best case.",
        params: [
          { label: "Transmit power", value: String(txDbm), unit: "dBm" },
          { label: "Node antenna gain", value: String(txGain), unit: "dBi" },
          { label: "Gateway antenna gain", value: String(rxGain), unit: "dBi" },
          { label: "Frequency", value: String(freq), unit: "MHz" },
          { label: "Distance", value: String(km), unit: "km" },
          { label: "Receiver sensitivity", value: String(sens), unit: "dBm" },
        ],
        fields: [
          { key: "fspl", label: "Free-space path loss", unit: "dB" },
          { key: "rx_power", label: "Received power", unit: "dBm" },
          { key: "margin", label: "Link margin", unit: "dB", help: "Received power minus receiver sensitivity." },
        ],
        key: { expected: { fspl, rx_power: rx, margin }, tolerance: { fspl: ABS_DB, rx_power: ABS_DB, margin: ABS_DB } },
        reference: ["FSPL (dB) = 20 log10(d in km) + 20 log10(f in MHz) + 32.44", "received power = Tx power + Tx gain + Rx gain - path loss", "margin = received power - sensitivity"],
      };
    },
  },
];
