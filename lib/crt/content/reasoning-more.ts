import { collect, int, near, pick, rng, shuffle, type BankRow, type Draft, type Rng } from "./draft";

// More logical-reasoning families. Every answer is computed from the numbers in the prompt, so the key is right by construction.
type Family = (r: Rng) => Draft | null;
const T = "Number & Letter Series";
const D = "Direction & Ranking";
const L = "Logical Puzzles";
const C = "Coding-Decoding";
const NAMES = ["Anu", "Bala", "Charan", "Divya", "Esha", "Farid", "Gita", "Hari", "Isha", "Jai"];

const interleaved: Family = (r) => {
  const a = int(r, 1, 20), da = int(r, 2, 6), b = int(r, 30, 60), db = int(r, 2, 8);
  const seq = [a, b, a + da, b - db, a + 2 * da, b - 2 * db, a + 3 * da];
  const next = b - 3 * db;
  return { topic: T, difficulty: 2, prompt: `Find the next number: ${seq.join(", ")}, ?`, correct: String(next), wrongs: near(r, next, String), explanation: `Two series alternate. Odd places go up by ${da} (${a}, ${a + da}, ...); even places go down by ${db} (${b}, ${b - db}, ...). The next even place is ${b - 2 * db} − ${db} = ${next}.` };
};

const missingMiddle: Family = (r) => {
  const a = int(r, 2, 30), d = int(r, 3, 11), hole = int(r, 1, 4);
  const seq = [0, 1, 2, 3, 4, 5].map((i) => a + i * d);
  const shown = seq.map((v, i) => (i === hole ? "?" : String(v)));
  return { topic: T, difficulty: 1, prompt: `Find the missing number: ${shown.join(", ")}`, correct: String(seq[hole]), wrongs: near(r, seq[hole], String, 1), explanation: `The numbers go up by ${d} each time, so the missing one is ${seq[hole - 1]} + ${d} = ${seq[hole]}.` };
};

const clockAngle: Family = (r) => {
  const h = int(r, 1, 11), m = pick(r, [0, 10, 20, 30, 40, 50]);
  const raw = Math.abs(30 * h - 5.5 * m), angle = raw > 180 ? 360 - raw : raw;
  const fmt = (x: number) => `${x}°`;
  return { topic: L, difficulty: 3, prompt: `What is the smaller angle between the hour and minute hands of a clock at ${h}:${String(m).padStart(2, "0")}?`, correct: fmt(angle), wrongs: near(r, angle, fmt, 0).concat([fmt(360 - angle)]).filter((x) => x !== fmt(angle)), explanation: `Hour hand: ${h} × 30 + ${m} × 0.5 = ${30 * h + m / 2}°. Minute hand: ${m} × 6 = ${6 * m}°. Difference = ${Math.abs(30 * h + m / 2 - 6 * m)}°${raw > 180 ? `, and the smaller angle is 360° − ${raw}° = ${angle}°` : ""}.` };
};

const mirrorTime: Family = (r) => {
  const h = int(r, 1, 11), m = int(r, 1, 59);
  const total = 12 * 60 - (h * 60 + m), mh = Math.floor(total / 60) || 12, mm = total % 60;
  const f = (hh: number, x: number) => `${hh}:${String(x).padStart(2, "0")}`;
  return { topic: L, difficulty: 3, prompt: `The time on a clock is ${f(h, m)}. What time would its mirror image show?`, correct: f(mh, mm), wrongs: [f(h, 60 - m), f(12 - h, m), f(11 - h < 1 ? 12 : 11 - h, 60 - m)].filter((x) => x !== f(mh, mm)), explanation: `A mirror image shows 12:00 minus the actual time: 12:00 − ${f(h, m)} = ${f(mh, mm)}.` };
};

const fromBothEnds: Family = (r) => {
  const n = int(r, 20, 60), p = int(r, 3, n - 3), q = n + 1 - p;
  const name = pick(r, NAMES);
  return { topic: D, difficulty: 1, prompt: `${name} ranks ${p}th from the top in a class of ${n} students. What is ${name}'s rank from the bottom?`, correct: `${q}th`, wrongs: [`${n - p}th`, `${q + 1}th`, `${q - 1}th`], explanation: `Rank from the bottom = ${n} − ${p} + 1 = ${q}.` };
};

const walk: Family = (r) => {
  const [a, b, c] = pick(r, [[3, 4, 5], [5, 12, 13], [8, 15, 17], [6, 8, 10], [9, 12, 15]]);
  const k = int(r, 1, 4), dirs = pick(r, [["east", "north"], ["west", "south"], ["north", "west"]]);
  const name = pick(r, NAMES);
  return { topic: D, difficulty: 2, prompt: `${name} walks ${a * k} km ${dirs[0]}, then turns and walks ${b * k} km ${dirs[1]}. How far is ${name} from the starting point?`, correct: `${c * k} km`, wrongs: [`${(a + b) * k} km`, `${Math.abs(b - a) * k} km`, `${c * k + 1} km`, `${c * k - 1} km`], explanation: `The two legs are at right angles, so distance = √(${a * k}² + ${b * k}²) = √${(a * k) ** 2 + (b * k) ** 2} = ${c * k} km.` };
};

const letterSum: Family = (r) => {
  const words = ["CAB", "BED", "FACE", "DEAF", "BAG", "HEAD", "DIG", "FIG", "BADGE", "CAGE", "ACE", "BEAD", "DECADE", "FADED"];
  const w = pick(r, words), sum = [...w].reduce((s, ch) => s + ch.charCodeAt(0) - 64, 0);
  return { topic: C, difficulty: 1, prompt: `If A = 1, B = 2, C = 3 and so on, what is the sum of the values of the letters in the word ${w}?`, correct: String(sum), wrongs: near(r, sum, String, 1), explanation: `${[...w].map((ch) => `${ch} = ${ch.charCodeAt(0) - 64}`).join(", ")}. Total = ${sum}.` };
};

const numberAnalogy: Family = (r) => {
  const k = int(r, 2, 5), add = int(r, 1, 9), a = int(r, 3, 12), b = int(r, 13, 25);
  const f = (x: number) => x * k + add;
  return { topic: L, difficulty: 2, prompt: `${a} : ${f(a)} :: ${b} : ?`, correct: String(f(b)), wrongs: [String(f(b) + k), String(b * k), String(f(b) - add + 1)].concat(near(r, f(b), String)).filter((x) => x !== String(f(b))), explanation: `Each number is multiplied by ${k} and ${add} is added: ${a} × ${k} + ${add} = ${f(a)}, so ${b} × ${k} + ${add} = ${f(b)}.` };
};

const circleOpposite: Family = (r) => {
  const n = pick(r, [8, 10, 12, 14, 16, 20]), p = int(r, 1, n);
  const ans = ((p + n / 2 - 1) % n) + 1;
  return { topic: D, difficulty: 2, prompt: `${n} people numbered 1 to ${n} sit in order around a circular table, equally spaced. Who sits directly opposite person ${p}?`, correct: `Person ${ans}`, wrongs: [`Person ${p + 1 > n ? 1 : p + 1}`, `Person ${p - 1 < 1 ? n : p - 1}`, `Person ${((ans) % n) + 1}`].filter((x) => x !== `Person ${ans}`), explanation: `Opposite means ${n / 2} seats away: ${p} + ${n / 2}${p + n / 2 > n ? ` − ${n}` : ""} = ${ans}.` };
};

const swappedSigns: Family = (r) => {
  const syms = ["+", "−", "×", "÷"], real = (s: string) => ({ "+": "+", "−": "-", "×": "*", "÷": "/" }[s]!);
  const [x, y] = shuffle(r, syms).slice(0, 2); // x really means y and y really means x
  const map = (s: string) => (s === x ? y : s === y ? x : s);
  const nums = [int(r, 2, 12), int(r, 2, 9), int(r, 2, 9)], ops = [pick(r, syms), pick(r, syms)];
  if (!ops.some((o) => o === x || o === y)) return null;
  const expr = `${nums[0]} ${real(map(ops[0]))} ${nums[1]} ${real(map(ops[1]))} ${nums[2]}`;
  const value = Function(`"use strict"; return (${expr})`)() as number;
  if (!Number.isInteger(value) || Math.abs(value) > 500) return null;
  return { topic: L, difficulty: 3, prompt: `If '${x}' means '${y}' and '${y}' means '${x}', what is the value of ${nums[0]} ${ops[0]} ${nums[1]} ${ops[1]} ${nums[2]}?`, correct: String(value), wrongs: near(r, value, String), explanation: `Swap the signs back: ${nums[0]} ${map(ops[0])} ${nums[1]} ${map(ops[1])} ${nums[2]}. Doing × and ÷ before + and − gives ${value}.` };
};

const tallest: Family = (r) => {
  const order = shuffle(r, NAMES).slice(0, 4), [first, second, third, last] = order;
  const facts = shuffle(r, [`${first} is taller than ${second}.`, `${second} is taller than ${third}.`, `${third} is taller than ${last}.`]);
  const askTallest = r() < 0.5;
  return { topic: L, difficulty: 1, prompt: `${facts.join(" ")} Who is the ${askTallest ? "tallest" : "shortest"}?`, correct: askTallest ? first : last, wrongs: order.filter((n) => n !== (askTallest ? first : last)), explanation: `Chaining the statements gives ${order.join(" > ")}, so the ${askTallest ? "tallest" : "shortest"} is ${askTallest ? first : last}.` };
};

const dateDay: Family = (r) => {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const d1 = int(r, 1, 12), gap = int(r, 4, 16), i = int(r, 0, 6), ans = days[(i + gap) % 7];
  return { topic: L, difficulty: 2, prompt: `If the ${d1}th of a month is a ${days[i]}, what day of the week is the ${d1 + gap}th of the same month?`, correct: ans, wrongs: days.filter((d) => d !== ans).slice(0, 5), explanation: `The gap is ${gap} days. ${gap} = ${Math.floor(gap / 7)} × 7 + ${gap % 7}, so the day moves ${gap % 7} forward from ${days[i]}: ${ans}.` };
};

const FAMILIES: [Family, number][] = [
  [interleaved, 40], [missingMiddle, 40], [clockAngle, 40], [mirrorTime, 40], [fromBothEnds, 40], [walk, 30],
  [letterSum, 12], [numberAnalogy, 40], [circleOpposite, 30], [swappedSigns, 50], [tallest, 40], [dateDay, 40],
];

export function reasoningMoreBank(): BankRow[] {
  return FAMILIES.flatMap(([make, count], i) => collect(rng(2100 + i), "reasoning", count, make));
}
