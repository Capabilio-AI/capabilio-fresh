// Drawings of each lab's set-up, built from the scenario and the current settings. Pure; they show configuration, never a verdict.
import type { Scene, SceneItem, Settings } from "./types";

type Any = Record<string, number | string>;
const n = (v: unknown) => Number(v);
const t = (x: number, y: number, text: string, anchor: "start" | "middle" | "end" = "middle", size = 11): SceneItem => ({ k: "text", x, y, text, anchor, size, tone: "muted" });

function crane(s: Any, st: Settings): Scene {
  const px = 40;
  const py = 135;
  const L = n(s.l) * 62;
  const a = n(s.a) * 62;
  const ay = py - n(st.h) * 26;
  const rope = Math.max(1, n(st.rope) / 3);
  return {
    title: "Wall-mounted jib crane", w: 400, h: 170,
    items: [
      { k: "rect", x: 28, y: 10, w: 12, h: 150, tone: "muted", fill: true },
      { k: "line", x1: px, y1: py, x2: px + L, y2: py, tone: "ink", w: 6 },
      { k: "line", x1: px + L, y1: py, x2: px, y2: ay, tone: "accent", w: rope },
      { k: "circle", x: px, y: py, r: Math.max(3, n(st.pin) / 3), tone: "ink", fill: true },
      { k: "circle", x: px, y: ay, r: 4, tone: "accent", fill: true },
      { k: "line", x1: px + a, y1: py, x2: px + a, y2: py + 26, tone: "ink", w: 1.5 },
      { k: "rect", x: px + a - 12, y: py + 26, w: 24, h: 14, tone: "bad", fill: true },
      t(px + a, py + 54, `${s.w} kN`),
      t(px + 8, ay - 8, `anchor ${st.h} m`, "start"),
      t(px + L / 2, py - 12, `boom ${s.l} m`),
    ],
  };
}

function pipeline(s: Any, st: Settings): Scene {
  const th = 3 + n(st.d) / 14;
  const lift = Math.min(70, n(s.lift) * 3);
  const tone = st.mat === "pvc" ? "water" : st.mat === "steel" ? "ink" : "muted";
  const yL = 140;
  const yR = yL - lift;
  return {
    title: "Pumped pipeline", w: 400, h: 170,
    items: [
      { k: "rect", x: 20, y: yL - 28, w: 50, h: 40, tone: "water" },
      { k: "line", x1: 70, y1: yL, x2: 175, y2: yL, tone, w: th },
      { k: "circle", x: 195, y: yL, r: 16, tone: "accent" },
      { k: "text", x: 195, y: yL + 4, text: "P", anchor: "middle", size: 12, tone: "accent" },
      { k: "line", x1: 211, y1: yL, x2: 300, y2: yL, tone, w: th },
      { k: "line", x1: 300, y1: yL, x2: 300, y2: yR, tone, w: th },
      { k: "line", x1: 300, y1: yR, x2: 330, y2: yR, tone, w: th },
      { k: "rect", x: 330, y: yR - 30, w: 52, h: 44, tone: "water" },
      { k: "line", x1: 388, y1: yL, x2: 388, y2: yR, tone: "muted", dash: true },
      t(40, yL + 28, "well"),
      t(356, yR + 28, "tank"),
      t(135, yL - th - 6, `${st.d} mm · ${s.length} m`),
      t(374, (yL + yR) / 2, `${s.lift} m`, "end"),
    ],
  };
}

function beam(s: Any, st: Settings): Scene {
  const h = 4 + n(st.h) / 14;
  const x0 = 50;
  const x1 = 350;
  const y = 90;
  const items: SceneItem[] = [
    { k: "rect", x: x0, y: y - h, w: x1 - x0, h, tone: "ink", fill: true },
    { k: "poly", pts: [[x0, y], [x0 - 12, y + 22], [x0 + 12, y + 22]], tone: "muted", fill: true },
    { k: "poly", pts: [[x1, y], [x1 - 12, y + 22], [x1 + 12, y + 22]], tone: "muted", fill: true },
    t(200, y + 44, `span ${s.span} m · ${st.b} × ${st.h} mm`),
  ];
  if (s.kind === "udl") {
    for (let x = x0 + 12; x < x1; x += 30) items.push({ k: "line", x1: x, y1: y - h - 30, x2: x, y2: y - h - 4, tone: "bad", w: 1.5 });
    items.push({ k: "line", x1: x0, y1: y - h - 32, x2: x1, y2: y - h - 32, tone: "bad", w: 1.5 }, t(200, y - h - 40, `${s.load} kN/m`));
  } else {
    items.push({ k: "line", x1: 200, y1: y - h - 46, x2: 200, y2: y - h - 4, tone: "bad", w: 3 }, { k: "poly", pts: [[200, y - h - 2], [194, y - h - 14], [206, y - h - 14]], tone: "bad", fill: true }, t(200, y - h - 54, `${s.load} kN`));
  }
  return { title: "Simply supported beam", w: 400, h: 170, items };
}

function heatExchanger(s: Any, st: Settings): Scene {
  const len = 40 + n(st.area) * 22;
  const x0 = 200 - len / 2;
  const counter = st.arr === "counter";
  const arrow = (x: number, y: number, right: boolean, tone: "bad" | "water"): SceneItem => ({ k: "poly", pts: right ? [[x, y], [x - 9, y - 6], [x - 9, y + 6]] : [[x, y], [x + 9, y - 6], [x + 9, y + 6]], tone, fill: true });
  return {
    title: "Heat exchanger", w: 400, h: 170,
    items: [
      { k: "rect", x: x0, y: 50, w: len, h: 70, tone: "muted" },
      { k: "line", x1: 20, y1: 70, x2: 380, y2: 70, tone: "bad", w: 4 },
      { k: "line", x1: 20, y1: 100, x2: 380, y2: 100, tone: "water", w: 4 },
      arrow(372, 70, true, "bad"),
      arrow(counter ? 28 : 372, 100, !counter ? true : false, "water"),
      t(40, 60, `oil ${s.tHotIn} °C`, "start"),
      t(40, 124, `water ${s.tColdIn} °C`, "start"),
      t(200, 146, `${st.area} m² · ${st.flow} kg/s · ${counter ? "counterflow" : "parallel flow"}`),
    ],
  };
}

function amplifier(s: Any, st: Settings): Scene {
  return {
    title: "Common-emitter stage", w: 400, h: 170,
    items: [
      { k: "line", x1: 40, y1: 20, x2: 320, y2: 20, tone: "bad", w: 2 },
      t(330, 24, `+${s.vcc} V`, "start"),
      { k: "line", x1: 40, y1: 150, x2: 320, y2: 150, tone: "ink", w: 2 },
      { k: "rect", x: 64, y: 40, w: 18, h: 36, tone: "ink" }, { k: "line", x1: 73, y1: 20, x2: 73, y2: 40, tone: "ink" }, t(92, 62, `R1 ${st.r1}k`, "start"),
      { k: "rect", x: 64, y: 96, w: 18, h: 36, tone: "ink" }, { k: "line", x1: 73, y1: 132, x2: 73, y2: 150, tone: "ink" }, t(92, 118, `R2 ${st.r2}k`, "start"),
      { k: "line", x1: 73, y1: 76, x2: 73, y2: 96, tone: "ink" }, { k: "line", x1: 73, y1: 86, x2: 170, y2: 86, tone: "ink" },
      { k: "circle", x: 195, y: 86, r: 26, tone: "accent" }, t(195, 90, "Q", "middle", 13),
      { k: "rect", x: 250, y: 40, w: 18, h: 30, tone: "ink" }, { k: "line", x1: 259, y1: 20, x2: 259, y2: 40, tone: "ink" }, { k: "line", x1: 259, y1: 70, x2: 259, y2: 74, tone: "ink" }, { k: "line", x1: 207, y1: 66, x2: 259, y2: 74, tone: "ink" }, t(278, 58, `RC ${st.rc}k`, "start"),
      { k: "rect", x: 250, y: 104, w: 18, h: 30, tone: "ink" }, { k: "line", x1: 259, y1: 134, x2: 259, y2: 150, tone: "ink" }, { k: "line", x1: 207, y1: 106, x2: 259, y2: 104, tone: "ink" }, t(278, 124, `RE ${st.re}k`, "start"),
    ],
  };
}

function dcMotor(s: Any, st: Settings): Scene {
  return {
    title: "Motor starter", w: 400, h: 170,
    items: [
      { k: "line", x1: 30, y1: 40, x2: 370, y2: 40, tone: "bad", w: 2 }, t(30, 30, "220 V DC", "start"),
      { k: "line", x1: 30, y1: 140, x2: 370, y2: 140, tone: "ink", w: 2 },
      { k: "rect", x: 60, y: 56, w: 70, h: 20, tone: "accent" }, t(95, 70, `Rs ${st.rs1} Ω`, "middle", 10),
      { k: "line", x1: 95, y1: 40, x2: 95, y2: 56, tone: "ink" }, { k: "line", x1: 95, y1: 76, x2: 95, y2: 96, tone: "ink" }, { k: "line", x1: 95, y1: 96, x2: 200, y2: 96, tone: "ink" },
      { k: "rect", x: 150, y: 114, w: 60, h: 18, tone: "muted" }, t(180, 127, `run ${st.rs2} Ω`, "middle", 10),
      { k: "circle", x: 255, y: 96, r: 34, tone: "ink" }, t(255, 101, "M", "middle", 16),
      { k: "line", x1: 255, y1: 62, x2: 255, y2: 40, tone: "ink" }, { k: "line", x1: 255, y1: 130, x2: 255, y2: 140, tone: "ink" },
      t(255, 158, `${st.field} field · ${s.iRated} A rated`),
    ],
  };
}

function signalTiming(s: Any, st: Settings): Scene {
  const la = n(st.lanesA);
  const lb = n(st.lanesB);
  const share = n(st.split) / 100;
  return {
    title: "Junction", w: 400, h: 170,
    items: [
      { k: "rect", x: 20, y: 52 - (la - 1) * 8, w: 220, h: 20 + (la - 1) * 16, tone: "muted", fill: true },
      { k: "rect", x: 112 - (lb - 1) * 8, y: 8, w: 20 + (lb - 1) * 16, h: 108, tone: "muted", fill: true },
      t(30, 48, `main ${s.qA} veh/h · ${la} lane${la > 1 ? "s" : ""}`, "start"),
      t(148, 24, `side ${s.qB}`, "start"),
      { k: "rect", x: 260, y: 56, w: 120, h: 14, tone: "good", fill: true },
      { k: "rect", x: 260 + 120 * share, y: 56, w: 120 * (1 - share), h: 14, tone: "accent", fill: true },
      t(320, 88, `green split ${st.split}% main`),
      t(320, 104, `cycle ${st.cycle} s`),
      t(200, 150, `${lb} side lane${lb > 1 ? "s" : ""}`),
    ],
  };
}

function foundation(s: Any, st: Settings): Scene {
  const w = 20 + n(st.b) * 40;
  const depth = n(st.df) * 22;
  const gy = 70;
  const cx = 200;
  const items: SceneItem[] = [
    { k: "rect", x: 20, y: gy, w: 360, h: 90, tone: s.soil === "clay" ? "bad" : "accent" },
    { k: "rect", x: cx - w / 2, y: gy + depth - 14, w, h: 14, tone: "ink", fill: true },
    { k: "rect", x: cx - 10, y: gy - 40, w: 20, h: depth + 26, tone: "ink", fill: true },
    t(cx, gy - 48, `${s.load} kN`),
    t(cx, gy + depth + 18, `B = ${st.b} m · Df = ${st.df} m`),
    t(40, 148, `${s.soil} soil`, "start"),
  ];
  if (st.imp === "cushion") items.push({ k: "rect", x: cx - w / 2 - 12, y: gy + depth, w: w + 24, h: 18, tone: "good" }, t(cx + w / 2 + 20, gy + depth + 13, "sand cushion", "start", 10));
  return { title: "Footing in the ground", w: 400, h: 170, items };
}

function rccColumn(_s: Any, st: Settings): Scene {
  const size = 50 + n(st.b) / 5;
  const x0 = 200 - size / 2;
  const y0 = 85 - size / 2;
  const bars = n(st.n);
  const r = 2 + n(st.dia) / 8;
  const inset = 10;
  const per: [number, number][] = bars === 4 ? [[0, 0], [1, 0], [0, 1], [1, 1]] : bars === 6 ? [[0, 0], [0.5, 0], [1, 0], [0, 1], [0.5, 1], [1, 1]] : bars === 8 ? [[0, 0], [0.5, 0], [1, 0], [0, 0.5], [1, 0.5], [0, 1], [0.5, 1], [1, 1]] : [[0, 0], [1 / 3, 0], [2 / 3, 0], [1, 0], [0, 1 / 3], [1, 1 / 3], [0, 2 / 3], [1, 2 / 3], [0, 1], [1 / 3, 1], [2 / 3, 1], [1, 1]];
  return {
    title: "Column cross-section", w: 400, h: 170,
    items: [
      { k: "rect", x: x0, y: y0, w: size, h: size, tone: "muted", fill: true },
      { k: "rect", x: x0 + inset - 3, y: y0 + inset - 3, w: size - 2 * inset + 6, h: size - 2 * inset + 6, tone: "ink" },
      ...per.map(([fx, fy]): SceneItem => ({ k: "circle", x: x0 + inset + fx * (size - 2 * inset), y: y0 + inset + fy * (size - 2 * inset), r, tone: "accent", fill: true })),
      t(200, 160, `${st.b} × ${st.b} mm · ${st.grade} · ${st.n} bars of ${st.dia} mm`),
    ],
  };
}

const SCENES: Record<string, (s: Any, st: Settings) => Scene> = { crane, pipeline: pipeline, beam, "heat-exchanger": heatExchanger, amplifier, "dc-motor": dcMotor, "signal-timing": signalTiming, foundation, "rcc-column": rccColumn };

export const sceneFor = (labKey: string, scenario: unknown, settings: Settings): Scene | null => SCENES[labKey]?.(scenario as Any, settings) ?? null;
