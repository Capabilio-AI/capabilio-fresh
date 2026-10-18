import { choices, fmt, gauge, info, objective, rupees } from "../util";
import { defineLab, type Lab, type Outcome, type Settings } from "../types";

// Off-grid solar plant sized on annual-average daily energy. Peak sun hours on a tilted plane ≈ 5.4 × cos(tilt − latitude); 80% system derate; 0.4 kWp per panel.
interface S { lat: number; dayKwh: number; nightKwh: number; peakKw: number; budget: number }

const PSH0 = 5.4;
const DERATE = 0.8;
const PANEL_KWP = 0.4;
const BATT_USABLE = 0.8 * 0.9; // depth of discharge × round trip
const INVERTERS = [6, 8, 10, 12, 15, 20, 25];
const COST = { panelKwp: 42_000, battKwh: 12_000, invKw: 9_000 };

function analyse(s: S, st: Settings) {
  const kwp = Number(st.panels) * PANEL_KWP;
  const psh = PSH0 * Math.max(0, Math.cos(((Number(st.tilt) - s.lat) * Math.PI) / 180));
  const yieldKwh = kwp * psh * DERATE;
  const need = s.dayKwh + s.nightKwh / 0.9;
  const night = Number(st.batt) * BATT_USABLE;
  const inv = Number(st.inv);
  const cost = kwp * COST.panelKwp + Number(st.batt) * COST.battKwh + inv * COST.invKw;
  return { kwp, psh, yieldKwh, need, night, inv, cost };
}

const lab: Lab<S> = {
  key: "solar-farm",
  family: "eee",
  format: "decision",
  name: "Solar plant planner",
  topic: "Renewable Energy · Solar PV sizing",
  keywords: ["renewable", "solar", "photovoltaic", "energy systems", "non-conventional", "power generation"],
  tools: ["Tilt adjuster", "Panel count", "Battery bank", "Inverter"],
  skillTags: ["PV tilt", "Battery sizing", "Inverter sizing"],
  makeScenario(rng, d) {
    const dayKwh = rng.pick([30, 40, 50, 60]);
    const nightKwh = rng.pick([15, 20, 25, 30]);
    const peakKw = rng.pick([6, 8, 10]);
    const lat = rng.pick([9, 13, 17, 21, 26]);
    // the budget is the cost of a sound design with a margin, so a plan always exists
    const tilt = Math.round(lat / 5) * 5;
    const psh = PSH0 * Math.cos(((tilt - lat) * Math.PI) / 180);
    const panels = Math.ceil((dayKwh + nightKwh / 0.9) / (psh * DERATE) / PANEL_KWP / 5) * 5;
    const batt = Math.max(10, Math.ceil(nightKwh / 0.9 / BATT_USABLE / 5) * 5);
    const inv = INVERTERS.find((i) => i >= Math.max(peakKw, (panels * PANEL_KWP) / 1.3)) ?? 25;
    const cost = panels * PANEL_KWP * COST.panelKwp + batt * COST.battKwh + inv * COST.invKw;
    return { lat, dayKwh, nightKwh, peakKw, budget: Math.ceil((cost * (d === "easy" ? 1.3 : d === "medium" ? 1.12 : 1.04)) / 5000) * 5000 };
  },
  given: (s) => [
    { label: "Site", value: `latitude ${s.lat}°N, annual-average sunshine` },
    { label: "Daily demand", value: `${s.dayKwh} kWh in daylight and ${s.nightKwh} kWh after dark, peak ${s.peakKw} kW` },
    { label: "Prices", value: `${rupees(COST.panelKwp)} per kWp, ${rupees(COST.battKwh)} per kWh of battery, ${rupees(COST.invKw)} per kW of inverter` },
  ],
  mission: (s) => `Plan a plant that supplies the whole day's energy, covers the night from the battery, handles the ${s.peakKw} kW peak without clipping and costs at most ${rupees(s.budget)}.`,
  controls: (s) => [
    { kind: "number", id: "tilt", label: "Panel tilt", min: 0, max: 60, step: 5, unit: "°", default: 0, focus: [s.lat] },
    { kind: "number", id: "panels", label: "Number of 400 W panels", min: 20, max: 70, step: 5, unit: "", default: 20 },
    { kind: "number", id: "batt", label: "Battery bank", min: 10, max: 60, step: 5, unit: "kWh", default: 10 },
    { kind: "choice", id: "inv", label: "Inverter size", options: choices(INVERTERS, (v) => `${v} kW`), default: "6" },
  ],
  evaluate(s, st): Outcome {
    const a = analyse(s, st);
    const nightNeed = s.nightKwh / 0.9;
    const clipped = a.kwp > a.inv * 1.3;
    const objectives = [
      objective("yield", `Daily energy ≥ ${fmt(a.need, 0)} kWh`, a.yieldKwh >= a.need, `${fmt(a.yieldKwh, 0)} kWh a day`, "Energy depends on the number of panels and on how much sunlight they catch at their tilt. What tilt suits this latitude?"),
      objective("batt", `Battery covers the night (${fmt(nightNeed, 0)} kWh)`, a.night >= nightNeed, `${fmt(a.night, 0)} kWh usable`, "Only part of the battery can be used each night, and some energy is lost going in and out."),
      objective("inv", `Inverter handles the ${s.peakKw} kW peak and does not clip the array`, a.inv >= s.peakKw && !clipped, `${a.inv} kW inverter, ${fmt(a.kwp, 1)} kWp array`, "The inverter must carry the peak load, and a very large array on a small inverter wastes power at noon."),
      objective("cost", `Cost ≤ ${rupees(s.budget)}`, a.cost <= s.budget, rupees(a.cost), "Every oversized part costs money. Which of them has margin you do not need?"),
    ];
    const pts = Array.from({ length: 13 }, (_, i): [number, number] => [i * 5, PSH0 * Math.max(0, Math.cos(((i * 5 - s.lat) * Math.PI) / 180))]);
    return {
      readings: [
        gauge("yield", "Daily energy", a.yieldKwh, `${fmt(a.yieldKwh, 0)} kWh`, { min: 0, max: Math.max(a.need * 2, a.yieldKwh * 1.1), low: a.need }),
        gauge("batt", "Usable night storage", a.night, `${fmt(a.night, 0)} kWh`, { min: 0, max: nightNeed * 3, low: nightNeed }),
        gauge("cost", "Total cost", a.cost, rupees(a.cost), { min: 0, max: s.budget * 1.6, high: s.budget }),
        info("psh", "Sun hours at this tilt", `${fmt(a.psh, 2)} h a day`),
      ],
      objectives,
      passed: objectives.every((o) => o.ok),
      series: {
        title: "Sun hours against panel tilt",
        xLabel: "tilt (°)",
        yLabel: "peak sun hours a day",
        lines: [{ name: "Sun hours", pts, style: "main" }, { name: "Your tilt", pts: [[Number(st.tilt), 0], [Number(st.tilt), PSH0]], style: "ref" }],
      },
    };
  },
  explain(s, st) {
    const a = analyse(s, st);
    return `A panel catches the most sunlight when it faces the sun squarely, and over a year that means tilting it about as far as the site's latitude (${s.lat}°). At ${st.tilt}° the plant gets ${fmt(a.psh, 2)} sun hours, so ${fmt(a.kwp, 1)} kWp produces ${fmt(a.yieldKwh, 0)} kWh a day after an ${Math.round((1 - DERATE) * 100)}% derate. The battery serves the night, but only about ${Math.round(BATT_USABLE * 100)}% of its capacity is usable, and the inverter must carry the peak load without being outsized by the array. Sizing each part to its need rather than all large keeps the cost at ${rupees(a.cost)}.`;
  },
  fallback: (s) => ({
    title: `Size a ${s.dayKwh + s.nightKwh} kWh-a-day solar plant`,
    story: "A rural health centre needs reliable power day and night from solar panels, a battery and an inverter, within a fixed budget. You choose the tilt and the sizes.",
  }),
};
export default defineLab(lab);
