import { GenerationRejected, type Difficulty } from "@/lib/arena-workstations/types";
import type { Rng } from "@/lib/workplace/rng";
import { relTol, type CalcDraft, type CalcField, type CalcKey, type CalcParam, type CalcTemplate } from "./types";

/**
 * CIVIL-01 Site Engineer calculation worksheets (calc_workspace, tier S). Every ticket states its own factors in the reference sheet; they are
 * exercise values, never a claim of IS-code compliance. Fictional Indian contractors, rupee amounts.
 */
export const SITE_AREAS = {
  quantities: "site-quantities",
  mix: "site-concrete-mix",
  levels: "site-levels-and-surveying",
  cost: "site-materials-and-cost",
  progress: "site-progress-and-planning",
  safety: "site-safety-calcs",
} as const;

const STATED = "Factors on this sheet are stated for this exercise only; they are not a claim of code compliance.";
const REQUESTERS = [
  { name: "Rohit Venkataraman", title: "Project Manager, Sahyadri Builders" },
  { name: "Meenal Joshi", title: "Senior Site Engineer, Tungabhadra Infra" },
  { name: "Imran Qureshi", title: "Planning Lead, Deccan Civil Works" },
];

const r3 = (n: number) => Math.round(n * 1000) / 1000;
/** True when x sits within `margin` of a whole number, i.e. a round-up or round-down would be a coin toss. */
const nearInt = (x: number, margin = 0.05) => Math.abs(x - Math.round(x)) < margin;
const p = (label: string, value: string | number, unit: string): CalcParam => ({ label, value: String(value), unit });
const f = (key: string, label: string, unit: string, help?: string): CalcField => ({ key, label, unit, ...(help ? { help } : {}) });

/** Rel/floor per field; anything not listed gets 1% with a 6 mm style floor. */
const key = (expected: Record<string, number>, over: Record<string, [number, number]> = {}): CalcKey => ({
  expected,
  tolerance: Object.fromEntries(Object.entries(expected).map(([k, v]) => [k, relTol(v, ...(over[k] ?? [0.01, 0.006]))])),
});
const exact: [number, number] = [0, 0.01];

/** Regenerates until `gen` returns a draft that is not near a rounding or pass/fail boundary; rejects the ticket if none does. */
export function clearOf<T>(gen: () => T | null, tries = 40): T {
  for (let i = 0; i < tries; i++) {
    const v = gen();
    if (v !== null) return v;
  }
  throw new GenerationRejected("every candidate sat on a rounding or pass/fail boundary");
}

type Body = Omit<CalcDraft, "requester">;
function site(id: string, area: string, difficulty: Difficulty, build: (rng: Rng) => Body): CalcTemplate {
  return { id, areas: [area], difficulty, minLevel: "fresher", build: (rng) => ({ requester: rng.pick(REQUESTERS), ...build(rng) }) };
}

const DOOR_AREA = 1.0 * 2.1;
const WINDOW_AREA = 1.2 * 1.2;

export const SITE_CALC_TEMPLATES: CalcTemplate[] = [
  site("site-footing-concrete", SITE_AREAS.quantities, "easy", (rng) => {
    const n = rng.int(4, 12);
    const side = rng.int(12, 20) / 10;
    const depth = rng.int(4, 6) / 10;
    return {
      title: "Concrete for the isolated footings",
      scenario: `Sahyadri Heights Block C has ${n} square isolated footings. Work out the concrete for one footing and for all of them so the batching plant can be booked.`,
      params: [p("Number of footings", n, "nos"), p("Footing side (square)", side, "m"), p("Footing depth", depth, "m")],
      fields: [f("one_footing", "Concrete in one footing", "m3"), f("total_volume", "Concrete in all footings", "m3")],
      key: key({ one_footing: side * side * depth, total_volume: n * side * side * depth }),
      reference: ["Volume = length x breadth x depth", "Total = number of footings x volume of one footing", "Ignore wastage in this ticket."],
    };
  }),
  site("site-plaster-area", SITE_AREAS.quantities, "easy", (rng) => {
    const l = rng.int(30, 60) / 10;
    const b = rng.int(30, 50) / 10;
    const h = 3;
    const windows = rng.int(1, 3);
    const walls = 2 * (l + b) * h - DOOR_AREA - windows * WINDOW_AREA;
    return {
      title: "Plaster area of a ground-floor room",
      scenario: "Kalyani Residency, flat G-04. The plastering gang needs the area to price: all four walls with the openings deducted, then the ceiling.",
      params: [p("Room length", l, "m"), p("Room breadth", b, "m"), p("Wall height", h, "m"), p("Doors (1.0 m x 2.1 m each)", 1, "nos"), p("Windows (1.2 m x 1.2 m each)", windows, "nos")],
      fields: [f("wall_area", "Net wall plaster area", "m2"), f("total_area", "Walls plus ceiling", "m2")],
      key: key({ wall_area: walls, total_area: walls + l * b }),
      reference: ["Wall area = perimeter x height, perimeter = 2 x (length + breadth)", "Deduct each door and window opening once", "Ceiling = length x breadth", STATED],
    };
  }),
  site("site-brick-wall", SITE_AREAS.quantities, "medium", (rng) => {
    const len = rng.int(8, 20);
    const doors = rng.int(1, 2);
    const windows = rng.int(1, 4);
    const area = len * 3 - doors * DOOR_AREA - windows * WINDOW_AREA;
    return {
      title: "Bricks for the boundary-wing wall",
      scenario: "A 200 mm thick brick wall is going up on the Vijaya Textiles extension. Deduct the openings and tell the store how many bricks to issue.",
      params: [p("Wall length", len, "m"), p("Wall height", 3, "m"), p("Wall thickness", 0.2, "m"), p("Doors (1.0 m x 2.1 m each)", doors, "nos"), p("Windows (1.2 m x 1.2 m each)", windows, "nos")],
      fields: [f("net_area", "Net wall face area", "m2"), f("net_volume", "Net brickwork volume", "m3"), f("bricks", "Bricks needed", "nos")],
      key: key({ net_area: area, net_volume: area * 0.2, bricks: area * 0.2 * 500 }, { bricks: [0.01, 2] }),
      reference: ["Net face area = length x height - openings", "Volume = net face area x thickness", "Bricks = 500 per m3 of brickwork (stated factor, includes mortar joints, no wastage)", STATED],
    };
  }),
  site("site-bar-steel", SITE_AREAS.quantities, "medium", (rng) => {
    const n = rng.int(8, 20);
    const dia = rng.pick([10, 12, 16]);
    const straight = rng.int(30, 60) / 10;
    const cut = straight + (2 * 9 * dia) / 1000;
    return {
      title: "Steel for the bent beam bars",
      scenario: "Each beam bar is cut straight and given a hook at both ends. The bar bender needs the cut length of one bar and the weight of the whole batch.",
      params: [p("Number of bars", n, "nos"), p("Bar diameter", dia, "mm"), p("Straight length between hooks", straight, "m")],
      fields: [f("cut_length", "Cut length of one bar", "m"), f("total_weight", "Weight of all bars", "kg")],
      key: key({ cut_length: cut, total_weight: (n * cut * dia * dia) / 162 }, { total_weight: [0.01, 0.5] }),
      reference: ["Hook allowance = 9 x diameter at each end (stated)", "Cut length = straight length + 2 hooks", "Unit weight = d x d / 162 kg per metre, d in mm", STATED],
    };
  }),
  site("site-nominal-mix", SITE_AREAS.mix, "easy", (rng) => {
    const [grade, c, s, a] = rng.pick([["M15", 1, 2, 4], ["M20", 1, 1.5, 3], ["M25", 1, 1, 2]] as const);
    const vol = rng.int(5, 30);
    const cement = (1.54 * vol * c) / (c + s + a);
    return {
      title: `Materials for ${vol} m3 of ${grade} concrete`,
      scenario: "The pour for the Gandhinagar Road retaining wall is booked. Convert the nominal mix to the cement, sand and aggregate to bring to site.",
      params: [p("Concrete required (wet)", vol, "m3"), p("Nominal mix (cement : sand : aggregate)", `${c} : ${s} : ${a}`, "by volume"), p("Grade", grade, "")],
      fields: [f("cement_bags", "Cement", "bags"), f("sand_m3", "Sand", "m3"), f("aggregate_m3", "Coarse aggregate", "m3")],
      key: key({ cement_bags: cement / 0.0347, sand_m3: (cement * s) / c, aggregate_m3: (cement * a) / c }, { cement_bags: [0.01, 0.6], sand_m3: [0.01, 0.05], aggregate_m3: [0.01, 0.05] }),
      reference: ["Dry volume = 1.54 x wet volume", "Each part = dry volume x part / (sum of parts)", "1 bag of cement = 50 kg = 0.0347 m3", "Do not round the bags until the end", STATED],
    };
  }),
  site("site-batch-wastage", SITE_AREAS.mix, "medium", (rng) => {
    const l = rng.int(40, 90) / 10;
    const b = rng.int(30, 60) / 10;
    const thick = rng.pick([0.12, 0.15]);
    const waste = rng.pick([3, 5, 8]);
    const wc = rng.pick([0.45, 0.5, 0.55]);
    const vol = l * b * thick * (1 + waste / 100);
    const bags = (1.54 * vol) / 5.5 / 0.0347;
    return {
      title: "Cement and water for the roof slab pour",
      scenario: "An M20 (1 : 1.5 : 3) slab is being cast on the Tulsi Court terrace. Order cement including the wastage allowance and give the batching water.",
      params: [p("Slab length", l, "m"), p("Slab breadth", b, "m"), p("Slab thickness", thick, "m"), p("Wastage allowance on concrete", waste, "%"), p("Water-cement ratio", wc, "by mass")],
      fields: [f("cement_bags", "Cement to order", "bags"), f("water_litres", "Batching water", "litres", "Use the unrounded bags")],
      key: key({ cement_bags: bags, water_litres: bags * 50 * wc }, { cement_bags: [0.01, 0.6], water_litres: [0.02, 5] }),
      reference: ["Concrete to order = slab volume x (1 + wastage / 100)", "Dry volume = 1.54 x concrete; cement share = 1 / (1 + 1.5 + 3) = 1 / 5.5", "1 bag = 50 kg = 0.0347 m3", "Water (litres) = cement mass (kg) x water-cement ratio", STATED],
    };
  }),
  site("site-cube-acceptance", SITE_AREAS.mix, "medium", (rng) =>
    clearOf(() => {
      const fck = rng.pick([20, 25, 30]);
      const loads = [0, 1, 2].map(() => Math.round((fck + rng.int(-4, 9)) * 22.5));
      const strengths = loads.map((x) => (x * 1000) / 22500);
      const avg = strengths.reduce((a, c) => a + c, 0) / 3;
      const low = Math.min(...strengths);
      if (Math.abs(avg - (fck + 3)) < 0.5 || Math.abs(low - (fck - 3)) < 0.5) return null;
      return {
        title: `Cube results for M${fck} concrete`,
        scenario: "Three 150 mm cubes from one pour of the Kanakadurga Mills slab were crushed at 28 days. Work out the strengths and apply this ticket's acceptance rule.",
        params: [p("Specified grade strength", fck, "MPa"), p("Cube 1 failure load", loads[0], "kN"), p("Cube 2 failure load", loads[1], "kN"), p("Cube 3 failure load", loads[2], "kN"), p("Cube face area", 22500, "mm2")],
        fields: [f("avg_strength", "Average cube strength", "MPa"), f("min_strength", "Lowest cube strength", "MPa"), f("accept", "Accept this pour", "1 = yes, 0 = no")],
        key: key({ avg_strength: avg, min_strength: low, accept: avg >= fck + 3 && low >= fck - 3 ? 1 : 0 }, { avg_strength: [0.01, 0.1], min_strength: [0.01, 0.1], accept: exact }),
        reference: ["Strength (MPa) = load (kN) x 1000 / area (mm2)", "Rule for this exercise: accept when the average is at least grade + 3 MPa and no cube is below grade - 3 MPa", "This is not the full code acceptance procedure.", STATED],
      };
    })),
  site("site-reduced-levels-hi", SITE_AREAS.levels, "easy", (rng) => {
    const rl = rng.int(98000, 102000) / 1000;
    const bs = rng.int(1200, 2400) / 1000;
    const is = rng.int(800, 2800) / 1000;
    const fs = rng.int(800, 2800) / 1000;
    const hi = rl + bs;
    return {
      title: "Reduced levels by height of collimation",
      scenario: "A level is set up near the Palasa Road drain. The backsight is on the benchmark; find the instrument height and the levels of the intermediate and foresight points.",
      params: [p("RL of benchmark", rl, "m"), p("Backsight on benchmark", bs, "m"), p("Intermediate sight", is, "m"), p("Foresight", fs, "m")],
      fields: [f("hi", "Height of collimation", "m"), f("rl_is", "RL at the intermediate point", "m"), f("rl_fs", "RL at the foresight point", "m")],
      key: key({ hi, rl_is: hi - is, rl_fs: hi - fs }, { hi: [0, 0.006], rl_is: [0, 0.006], rl_fs: [0, 0.006] }),
      reference: ["Height of collimation = RL of benchmark + backsight", "RL of a point = height of collimation - staff reading at that point"],
    };
  }),
  site("site-rise-fall", SITE_AREAS.levels, "medium", (rng) =>
    clearOf(() => {
      const readings = [0, 1, 2, 3, 4].map(() => rng.int(900, 2900));
      const steps = readings.slice(1).map((x, i) => readings[i] - x);
      if (steps.some((d) => Math.abs(d) < 50)) return null;
      const rise = steps.filter((d) => d > 0).reduce((a, c) => a + c, 0) / 1000;
      const fall = -steps.filter((d) => d < 0).reduce((a, c) => a + c, 0) / 1000;
      if (rise === 0 || fall === 0) return null;
      const rl = rng.int(98000, 102000) / 1000;
      return {
        title: "Levels along the road by rise and fall",
        scenario: "Five staff readings were taken in a row from one set-up along the Anjani Nagar access road, the first on the benchmark. Work the rise and fall method.",
        params: [p("RL of benchmark", rl, "m"), ...readings.map((x, i) => p(`Staff reading ${i + 1}${i === 0 ? " (on benchmark)" : ""}`, x / 1000, "m"))],
        fields: [f("total_rise", "Sum of rises", "m"), f("total_fall", "Sum of falls", "m"), f("rl_last", "RL at reading 5", "m")],
        key: key({ total_rise: rise, total_fall: fall, rl_last: rl + rise - fall }),
        reference: ["Between two readings: rise = previous - next when positive; fall when negative (take it as a positive number)", "RL of a point = RL of previous point + rise - fall", "Check: first RL + sum of rises - sum of falls = last RL"],
      };
    })),
  site("site-cut-fill", SITE_AREAS.levels, "medium", (rng) =>
    clearOf(() => {
      const fa = rng.int(99000, 101000) / 1000;
      const dist = rng.int(4, 10) * 10;
      const n = rng.pick([200, 250, 400, 500]);
      const fb = r3(fa - dist / n);
      const ground = r3(fa + rng.int(-400, 400) / 1000);
      const cut = r3(ground - fb);
      if (Math.abs(cut) < 0.08) return null;
      return {
        title: "Drain gradient and cut or fill at the outfall",
        scenario: "A storm drain at Ravindra Nagar falls from point A to point B at a steady gradient. Find the drain bed level at B and how much to cut or fill there.",
        params: [p("Drain bed RL at A", fa, "m"), p("Distance A to B", dist, "m"), p("Gradient (falling A to B)", `1 in ${n}`, ""), p("Existing ground RL at B", ground, "m")],
        fields: [f("gradient_percent", "Gradient", "%"), f("bed_b", "Drain bed RL at B", "m"), f("cut_b", "Cut (+) or fill (-) at B", "m")],
        key: key({ gradient_percent: 100 / n, bed_b: fb, cut_b: cut }, { gradient_percent: [0.01, 0.01] }),
        reference: ["Gradient 1 in N means a fall of 1 m in every N m; as a percentage = 100 / N", "Bed RL at B = bed RL at A - distance / N", "Cut (+) = ground RL - bed RL when ground is higher; fill is negative"],
      };
    })),
  site("site-boq-line-totals", SITE_AREAS.cost, "easy", (rng) => {
    const catalogue = [
      ["Earth excavation", "m3", 180, 260],
      ["PCC 1:4:8", "m3", 5200, 6200],
      ["Brickwork in CM 1:6", "m3", 6800, 8200],
      ["Plastering 12 mm", "m2", 320, 420],
      ["Steel reinforcement", "kg", 68, 82],
    ] as const;
    const items = rng.shuffle(catalogue).slice(0, 3).map(([name, unit, lo, hi]) => ({ name, unit, rate: rng.int(lo, hi), qty: rng.int(8, 60) * 5 }));
    const lines = items.map((i) => i.rate * i.qty);
    return {
      title: "Bill of quantities line totals",
      scenario: "Prepare the running bill for Meghdoot Constructions' plinth works: price each line and add them up.",
      params: items.flatMap((i, k) => [p(`Item ${k + 1} rate: ${i.name}`, i.rate, `Rs per ${i.unit}`), p(`Item ${k + 1} quantity`, i.qty, i.unit)]),
      fields: [...items.map((i, k) => f(`line${k + 1}`, `Item ${k + 1} amount`, "Rs")), f("subtotal", "Bill subtotal", "Rs")],
      key: key({ line1: lines[0], line2: lines[1], line3: lines[2], subtotal: lines[0] + lines[1] + lines[2] }, { line1: [0.005, 1], line2: [0.005, 1], line3: [0.005, 1], subtotal: [0.005, 1] }),
      reference: ["Line amount = rate x quantity", "Subtotal = sum of the three line amounts"],
    };
  }),
  site("site-gst-overhead", SITE_AREAS.cost, "medium", (rng) => {
    const base = rng.int(40, 400) * 1000;
    const oh = rng.pick([8, 10, 12]);
    const profit = rng.pick([5, 8, 10]);
    const gst = rng.pick([12, 18]);
    const withOh = base * (1 + oh / 100);
    const withProfit = withOh * (1 + profit / 100);
    return {
      title: "Quote build-up with overhead, profit and GST",
      scenario: "Mahalakshmi Infra is quoting a drainage package. Stack overhead, then profit, then GST on the direct cost, in that order.",
      params: [p("Direct cost", base, "Rs"), p("Overhead on direct cost", oh, "%"), p("Profit on (direct cost + overhead)", profit, "%"), p("GST on the total so far", gst, "%")],
      fields: [f("after_overhead", "Cost with overhead", "Rs"), f("after_profit", "Cost with profit", "Rs"), f("gst_amount", "GST amount", "Rs"), f("grand_total", "Quote value", "Rs")],
      key: key({ after_overhead: withOh, after_profit: withProfit, gst_amount: withProfit * (gst / 100), grand_total: withProfit * (1 + gst / 100) }, { after_overhead: [0.005, 1], after_profit: [0.005, 1], gst_amount: [0.005, 1], grand_total: [0.005, 1] }),
      reference: ["Each step applies its percentage to the running total, not to the direct cost alone", "GST rate is stated for this exercise", STATED],
    };
  }),
  site("site-material-reconciliation", SITE_AREAS.cost, "medium", (rng) => {
    const opening = rng.int(40, 200);
    const received = rng.int(100, 400);
    const shortfall = rng.int(2, 15);
    const issued = rng.int(80, opening + received - 30);
    const physical = opening + received - issued - shortfall;
    return {
      title: "Cement stock reconciliation",
      scenario: "Month end at the Sri Venkateswara Towers store. Compare the book balance with the physical count and work out the wastage.",
      params: [p("Opening stock", opening, "bags"), p("Received during month", received, "bags"), p("Issued to work", issued, "bags"), p("Physical count at month end", physical, "bags")],
      fields: [f("book_balance", "Book balance", "bags"), f("shortfall", "Shortfall against book", "bags"), f("wastage_pct", "Wastage on bags issued", "%")],
      key: key({ book_balance: opening + received - issued, shortfall, wastage_pct: (shortfall / issued) * 100 }, { book_balance: exact, shortfall: exact, wastage_pct: [0.02, 0.1] }),
      reference: ["Book balance = opening + received - issued", "Shortfall = book balance - physical count", "Wastage % = shortfall / bags issued x 100"],
    };
  }),
  site("site-productivity-crew-days", SITE_AREAS.progress, "easy", (rng) => {
    const rate = rng.pick([8, 10, 12, 15]);
    const qty = rng.int(15, 60) * 10;
    const crew = rng.int(3, 8);
    return {
      title: "Crew-days and duration for the block work",
      scenario: "Hosur Lane flats need blockwork. Using the crew's output per day, work out the effort and how long it takes with the crew on site.",
      params: [p("Quantity of work", qty, "m2"), p("Output per mason per day", rate, "m2"), p("Masons on the job", crew, "nos")],
      fields: [f("crew_days", "Effort", "mason-days"), f("duration_days", "Duration", "days")],
      key: key({ crew_days: qty / rate, duration_days: qty / (rate * crew) }, { crew_days: [0.01, 0.06], duration_days: [0.01, 0.06] }),
      reference: ["Effort (mason-days) = quantity / output per mason per day", "Duration (days) = effort / number of masons"],
    };
  }),
  site("site-percent-complete", SITE_AREAS.progress, "medium", (rng) => {
    const names = ["Excavation", "PCC", "Footing concrete"];
    const acts = names.map((name) => {
      const total = rng.int(5, 20) * 20;
      return { name, budget: rng.int(2, 9) * 50000, total, done: (total / 20) * (rng.int(2, 19) * 1) };
    });
    const earned = acts.reduce((s, a) => s + (a.budget * a.done) / a.total, 0);
    const budget = acts.reduce((s, a) => s + a.budget, 0);
    return {
      title: "Value-weighted percent complete",
      scenario: "Progress review at the Nandi Hills warehouse: three activities have different budgets, so overall progress is weighted by value.",
      params: acts.flatMap((a) => [p(`${a.name}: budget`, a.budget, "Rs"), p(`${a.name}: total quantity`, a.total, "units"), p(`${a.name}: quantity done`, a.done, "units")]),
      fields: [f("earned_value", "Earned value", "Rs"), f("overall_pct", "Overall percent complete", "%")],
      key: key({ earned_value: earned, overall_pct: (earned / budget) * 100 }, { earned_value: [0.005, 1], overall_pct: [0.01, 0.1] }),
      reference: ["Activity earned value = budget x quantity done / total quantity", "Earned value = sum over the activities", "Overall % = earned value / total budget x 100"],
    };
  }),
  site("site-schedule-delay", SITE_AREAS.progress, "medium", (rng) =>
    clearOf(() => {
      const planned = rng.int(8, 16) * 10;
      const day = rng.int(2, 4) * 10;
      const done = rng.int(15, 45);
      const forecast = (day * 100) / done;
      if (Math.abs(forecast - planned) < 5) return null;
      return {
        title: "Forecast finish at the current pace",
        scenario: "The Chandra Layout road package was planned for a fixed duration. Project the finish if the pace so far continues and compare it with the plan.",
        params: [p("Planned total duration", planned, "days"), p("Days elapsed", day, "days"), p("Work completed so far", done, "%")],
        fields: [f("forecast_days", "Forecast total duration", "days"), f("delay_days", "Delay (+) or ahead (-)", "days")],
        key: key({ forecast_days: forecast, delay_days: forecast - planned }, { forecast_days: [0.01, 0.2], delay_days: [0.01, 0.2] }),
        reference: ["Pace = % complete / days elapsed", "Forecast total duration = 100 / pace", "Delay = forecast total duration - planned duration"],
      };
    })),
  site("site-scaffold-capacity", SITE_AREAS.safety, "easy", (rng) =>
    clearOf(() => {
      const l = rng.int(20, 40) / 10;
      const b = rng.pick([1.0, 1.2, 1.5]);
      const rated = rng.pick([1.5, 2.0, 2.5]);
      const workers = rng.int(2, 5);
      const material = rng.int(5, 40) / 10;
      const capacity = rated * l * b;
      const applied = workers * 0.8 + material;
      const util = (applied / capacity) * 100;
      if (Math.abs(util - 100) < 5) return null;
      return {
        title: "Working platform: load against capacity",
        scenario: "A bay of the Shanti Apartments facade scaffold will take workers and a stack of material. Compare the load with the platform's stated limit.",
        params: [p("Platform length", l, "m"), p("Platform width", b, "m"), p("Stated limit", rated, "kN per m2"), p("Workers", workers, "nos"), p("Weight per worker", 0.8, "kN"), p("Stacked material", material, "kN")],
        fields: [f("capacity_kn", "Platform capacity", "kN"), f("applied_kn", "Applied load", "kN"), f("utilisation_pct", "Utilisation", "%"), f("within_limit", "Within the stated limit", "1 = yes, 0 = no")],
        key: key({ capacity_kn: capacity, applied_kn: applied, utilisation_pct: util, within_limit: applied <= capacity ? 1 : 0 }, { capacity_kn: [0.01, 0.02], applied_kn: [0.01, 0.02], utilisation_pct: [0.01, 0.3], within_limit: exact }),
        reference: ["Capacity = stated limit x length x width", "Applied = workers x weight per worker + stacked material", "Utilisation = applied / capacity x 100", "This compares two numbers; it is not a safety check of a real scaffold."],
      };
    })),
  site("site-ppe-counts", SITE_AREAS.safety, "easy", (rng) =>
    clearOf(() => {
      const crew = rng.int(24, 90);
      const high = rng.int(6, 24);
      if (nearInt(crew * 1.1) || nearInt(high * 1.1)) return null;
      return {
        title: "PPE to issue for the shift",
        scenario: "The store at Orchid Park needs the day's PPE count: a helmet for everyone and a harness for those working at height, each with 10% spare.",
        params: [p("Workers on the shift", crew, "nos"), p("Workers at height", high, "nos"), p("Spare allowance", 10, "%")],
        fields: [f("helmets", "Helmets to issue", "nos"), f("harnesses", "Harnesses to issue", "nos")],
        key: key({ helmets: Math.ceil(crew * 1.1), harnesses: Math.ceil(high * 1.1) }, { helmets: exact, harnesses: exact }),
        reference: ["Count = people x (1 + spare / 100), rounded up to a whole item", "Helmets cover all workers; harnesses only those at height"],
      };
    })),
  site("site-hoist-limit", SITE_AREAS.safety, "medium", (rng) =>
    clearOf(() => {
      const rated = rng.pick([500, 750, 1000]);
      const bags = rng.int(3, 10);
      const remaining = rated - 40 - bags * 50;
      if (remaining < 50 || nearInt(remaining / 3.2, 0.1)) return null;
      return {
        title: "Material hoist: room left in the load",
        scenario: "The Krishna Gardens material hoist carries a pallet of cement bags. Find the remaining capacity and how many whole bricks may be added to stay within the stated limit.",
        params: [p("Hoist rated load", rated, "kg"), p("Empty pallet", 40, "kg"), p("Cement bags on pallet", bags, "nos"), p("Mass of one bag", 50, "kg"), p("Mass of one brick", 3.2, "kg")],
        fields: [f("remaining_kg", "Remaining capacity", "kg"), f("max_bricks", "Most whole bricks that fit", "nos")],
        key: key({ remaining_kg: remaining, max_bricks: Math.floor(remaining / 3.2) }, { remaining_kg: [0, 0.5], max_bricks: exact }),
        reference: ["Remaining = rated load - pallet - bags x mass per bag", "Bricks = remaining / mass per brick, rounded down", "A simple load-against-limit sum; not a lifting-plan or safety approval."],
      };
    })),
];
