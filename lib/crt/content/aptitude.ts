import { collect, int, near, pick, rng, type BankRow, type Draft, type Rng } from "./draft";

const gcd = (a: number, b: number): number => (b === 0 ? a : gcd(b, a % b));
const rs = (n: number) => `Rs ${n}`;
const pc = (n: number) => `${n}%`;
const frac = (n: number, d: number) => `${n / gcd(n, d)}/${d / gcd(n, d)}`;
const fact = (n: number): number => (n <= 1 ? 1 : n * fact(n - 1));

type Family = { topic: string; make: (r: Rng) => Draft | null };

const percentOf: Family = { topic: "Percentages", make: (r) => {
  const p = pick(r, [5, 10, 15, 20, 25, 30, 35, 40, 45, 60, 75]);
  const n = int(r, 2, 40) * 20;
  const a = (n * p) / 100;
  return { topic: "Percentages", difficulty: 1, prompt: `What is ${p}% of ${n}?`, correct: String(a), wrongs: near(r, a), explanation: `${p}% of ${n} = ${p}/100 × ${n} = ${a}.` };
} };

const percentChange: Family = { topic: "Percentages", make: (r) => {
  const p = pick(r, [4, 8, 12, 16, 20, 24, 28, 40, 44, 60]);
  const a = int(r, 4, 40) * 25;
  const up = r() < 0.5;
  const b = up ? a + (a * p) / 100 : a - (a * p) / 100;
  return { topic: "Percentages", difficulty: 2, prompt: `A price ${up ? "rises" : "falls"} from Rs ${a} to Rs ${b}. What is the percentage ${up ? "increase" : "decrease"}?`, correct: pc(p), wrongs: near(r, p, pc, 1), explanation: `Change = ${Math.abs(b - a)}. ${Math.abs(b - a)}/${a} × 100 = ${p}%.` };
} };

const profitPercent: Family = { topic: "Profit & Loss", make: (r) => {
  const k = int(r, 2, 40);
  const cp = k * 100;
  const p = pick(r, [10, 12, 15, 20, 25, 30, 40]);
  const sp = cp + k * p;
  return { topic: "Profit & Loss", difficulty: 2, prompt: `An article bought for Rs ${cp} is sold for Rs ${sp}. What is the profit percentage?`, correct: pc(p), wrongs: near(r, p, pc, 1), explanation: `Profit = ${sp} − ${cp} = ${k * p}. ${k * p}/${cp} × 100 = ${p}%.` };
} };

const spFromProfit: Family = { topic: "Profit & Loss", make: (r) => {
  const k = int(r, 2, 40);
  const cp = k * 100;
  const p = pick(r, [10, 12, 15, 20, 25, 30, 40]);
  const loss = r() < 0.4;
  const sp = loss ? cp - k * p : cp + k * p;
  return { topic: "Profit & Loss", difficulty: 1, prompt: `The cost price of an item is Rs ${cp}. It is sold at a ${loss ? "loss" : "profit"} of ${p}%. What is the selling price?`, correct: rs(sp), wrongs: near(r, sp, rs, 1), explanation: `${p}% of ${cp} = ${k * p}. Selling price = ${cp} ${loss ? "−" : "+"} ${k * p} = ${sp}.` };
} };

const discount: Family = { topic: "Profit & Loss", make: (r) => {
  const k = int(r, 2, 40);
  const m = k * 100;
  const d = pick(r, [10, 15, 20, 25, 30, 40]);
  const sp = m - k * d;
  return { topic: "Profit & Loss", difficulty: 1, prompt: `A shirt is marked at Rs ${m} and sold at a discount of ${d}%. What is the selling price?`, correct: rs(sp), wrongs: near(r, sp, rs, 1), explanation: `Discount = ${d}% of ${m} = ${k * d}. Price = ${m} − ${k * d} = ${sp}.` };
} };

const successive: Family = { topic: "Profit & Loss", make: (r) => {
  const [a, b, f] = pick(r, [[20, 10, 72], [10, 10, 81], [20, 20, 64], [25, 20, 60], [50, 20, 40], [30, 10, 63]] as const);
  const k = int(r, 2, 30);
  const m = k * 100;
  const sp = k * f;
  return { topic: "Profit & Loss", difficulty: 3, prompt: `Two successive discounts of ${a}% and ${b}% are given on an item marked at Rs ${m}. What is the final price?`, correct: rs(sp), wrongs: [rs(m - (m * (a + b)) / 100), ...near(r, sp, rs, 1)], explanation: `Pay ${100 - a}% then ${100 - b}%: ${m} × ${(100 - a) / 100} × ${(100 - b) / 100} = ${sp}. (Adding the discounts is the common mistake.)` };
} };

const ratioShare: Family = { topic: "Ratios & Averages", make: (r) => {
  const [x, y] = pick(r, [[2, 3], [3, 4], [1, 4], [3, 5], [2, 5], [4, 5], [5, 7], [3, 7]] as const);
  const t = (x + y) * int(r, 3, 30) * 10;
  const a = (t * x) / (x + y);
  return { topic: "Ratios & Averages", difficulty: 1, prompt: `Rs ${t} is divided between A and B in the ratio ${x}:${y}. How much does A get?`, correct: rs(a), wrongs: [rs((t * y) / (x + y)), ...near(r, a, rs, 1)], explanation: `A gets ${x}/${x + y} of ${t} = ${a}.` };
} };

const averageNew: Family = { topic: "Ratios & Averages", make: (r) => {
  const n = pick(r, [4, 5, 6, 9]);
  const a = int(r, 20, 60);
  const d = int(r, 1, 5);
  const x = a + d * (n + 1);
  return { topic: "Ratios & Averages", difficulty: 2, prompt: `The average of ${n} numbers is ${a}. When one more number is included, the average becomes ${a + d}. What is the new number?`, correct: String(x), wrongs: near(r, x, String, 1), explanation: `New total = ${n + 1} × ${a + d} = ${(n + 1) * (a + d)}. Old total = ${n} × ${a} = ${n * a}. Difference = ${x}.` };
} };

const workTogether: Family = { topic: "Time & Work", make: (r) => {
  const [a, b, t] = pick(r, [[12, 12, 6], [20, 30, 12], [15, 10, 6], [30, 20, 12], [6, 3, 2], [12, 6, 4], [10, 15, 6], [60, 40, 24], [24, 8, 6], [18, 9, 6]] as const);
  return { topic: "Time & Work", difficulty: 2, prompt: `A can finish a job in ${a} days and B can finish it in ${b} days. Working together, in how many days will they finish it?`, correct: `${t} days`, wrongs: near(r, t, (x) => `${x} days`, 1), explanation: `Per day they do 1/${a} + 1/${b} = ${a + b}/${a * b}. Days = ${a * b}/${a + b} = ${t}.` };
} };

const pipes: Family = { topic: "Time & Work", make: (r) => {
  const [a, b] = pick(r, [[6, 12], [10, 15], [20, 30], [12, 18], [4, 12], [15, 20], [8, 24], [9, 18]] as const);
  const t = (a * b) / (b - a);
  return { topic: "Time & Work", difficulty: 3, prompt: `A pipe fills a tank in ${a} hours and another pipe empties it in ${b} hours. If both are opened, how long to fill the tank?`, correct: `${t} hours`, wrongs: near(r, t, (x) => `${x} hours`, 1), explanation: `Net per hour = 1/${a} − 1/${b} = ${b - a}/${a * b}. Time = ${a * b}/${b - a} = ${t} hours.` };
} };

const distance: Family = { topic: "Time, Speed & Distance", make: (r) => {
  const s = int(r, 6, 18) * 5;
  const t = int(r, 2, 8);
  const d = s * t;
  return { topic: "Time, Speed & Distance", difficulty: 1, prompt: `A car travels at ${s} km/h for ${t} hours. How far does it go?`, correct: `${d} km`, wrongs: near(r, d, (x) => `${x} km`, 1), explanation: `Distance = speed × time = ${s} × ${t} = ${d} km.` };
} };

const avgSpeed: Family = { topic: "Time, Speed & Distance", make: (r) => {
  const [x, y, v] = pick(r, [[40, 60, 48], [30, 60, 40], [20, 30, 24], [60, 90, 72], [40, 24, 30], [50, 75, 60], [30, 45, 36]] as const);
  return { topic: "Time, Speed & Distance", difficulty: 3, prompt: `A man travels a distance at ${x} km/h and returns the same way at ${y} km/h. What is his average speed for the whole trip?`, correct: `${v} km/h`, wrongs: [`${(x + y) / 2} km/h`, ...near(r, v, (n) => `${n} km/h`, 1)], explanation: `For equal distances, average speed = 2xy/(x+y) = 2×${x}×${y}/${x + y} = ${v} km/h. It is not the simple average.` };
} };

const train: Family = { topic: "Time, Speed & Distance", make: (r) => {
  const kmh = pick(r, [36, 54, 72, 90, 108]);
  const v = (kmh * 5) / 18;
  const t = int(r, 6, 20);
  const len = v * t;
  return { topic: "Time, Speed & Distance", difficulty: 2, prompt: `A ${len} m long train runs at ${kmh} km/h. How long does it take to cross a pole?`, correct: `${t} seconds`, wrongs: near(r, t, (x) => `${x} seconds`, 1), explanation: `${kmh} km/h = ${v} m/s. Time = ${len}/${v} = ${t} seconds.` };
} };

const simpleInterest: Family = { topic: "Interest", make: (r) => {
  const p = int(r, 5, 50) * 1000;
  const rate = pick(r, [5, 8, 10, 12]);
  const t = pick(r, [2, 3, 4, 5]);
  const si = (p * rate * t) / 100;
  return { topic: "Interest", difficulty: 1, prompt: `What is the simple interest on Rs ${p} at ${rate}% per year for ${t} years?`, correct: rs(si), wrongs: near(r, si, rs, 1), explanation: `SI = P × R × T / 100 = ${p} × ${rate} × ${t} / 100 = ${si}.` };
} };

const compoundInterest: Family = { topic: "Interest", make: (r) => {
  const rate = pick(r, [10, 20]);
  const k = int(r, 2, 40);
  const p = k * 100;
  const ci = k * (rate === 10 ? 21 : 44);
  return { topic: "Interest", difficulty: 3, prompt: `What is the compound interest on Rs ${p} at ${rate}% per year for 2 years, compounded yearly?`, correct: rs(ci), wrongs: [rs((p * rate * 2) / 100), ...near(r, ci, rs, 1)], explanation: `Amount = ${p} × ${(100 + rate) / 100}² = ${p + ci}. CI = ${p + ci} − ${p} = ${ci}. (Simple interest would be ${(p * rate * 2) / 100}.)` };
} };

const hcf: Family = { topic: "Number Systems", make: (r) => {
  const [a, b] = pick(r, [[2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [5, 6], [3, 7], [2, 7]] as const);
  const g = int(r, 2, 9);
  return { topic: "Number Systems", difficulty: 1, prompt: `What is the HCF of ${g * a} and ${g * b}?`, correct: String(g), wrongs: [String(g * a * b), ...near(r, g, String, 1)], explanation: `${g * a} = ${g}×${a} and ${g * b} = ${g}×${b}, and ${a} and ${b} share no factor, so HCF = ${g}.` };
} };

const lcm: Family = { topic: "Number Systems", make: (r) => {
  const [a, b] = pick(r, [[2, 3], [3, 4], [2, 5], [3, 5], [4, 5], [5, 6], [3, 7], [2, 7]] as const);
  const g = int(r, 2, 9);
  const l = g * a * b;
  return { topic: "Number Systems", difficulty: 2, prompt: `What is the LCM of ${g * a} and ${g * b}?`, correct: String(l), wrongs: [String(g), String(g * a * b * g), ...near(r, l, String, 1)], explanation: `LCM = HCF × ${a} × ${b} = ${g} × ${a * b} = ${l}.` };
} };

const remainder9: Family = { topic: "Number Systems", make: (r) => {
  const n = int(r, 1000, 99999);
  const rem = n % 9;
  return { topic: "Number Systems", difficulty: 2, prompt: `What is the remainder when ${n} is divided by 9?`, correct: String(rem), wrongs: [0, 1, 2, 3, 4, 5, 6, 7, 8].filter((x) => x !== rem).map(String), explanation: `The remainder equals the digit sum mod 9: ${String(n).split("").join("+")} = ${String(n).split("").reduce((s, c) => s + Number(c), 0)}, which leaves ${rem}.` };
} };

const mixture: Family = { topic: "Ratios & Averages", make: (r) => {
  for (let i = 0; i < 80; i++) {
    const x = int(r, 1, 6) * 2;
    const y = int(r, 1, 6) * 2;
    const a = int(r, 10, 40) * 2;
    const b = int(r, 10, 40) * 2;
    if (a === b || (x * a + y * b) % (x + y) !== 0) continue;
    const m = (x * a + y * b) / (x + y);
    return { topic: "Ratios & Averages", difficulty: 3, prompt: `${x} kg of rice at Rs ${a} per kg is mixed with ${y} kg of rice at Rs ${b} per kg. What is the price per kg of the mixture?`, correct: `Rs ${m}`, wrongs: [`Rs ${(a + b) / 2}`, ...near(r, m, (n) => `Rs ${n}`, 1)], explanation: `Total cost = ${x}×${a} + ${y}×${b} = ${x * a + y * b} for ${x + y} kg, so ${m} per kg. (Averaging the two prices ignores the quantities.)` };
  }
  return null;
} };

const ages: Family = { topic: "Ratios & Averages", make: (r) => {
  const b = int(r, 8, 25);
  const n = int(r, 2, 10);
  const a = 2 * b + n;
  return { topic: "Ratios & Averages", difficulty: 3, prompt: `A is ${a} years old. After ${n} years, A will be twice as old as B. What is B's present age?`, correct: `${b} years`, wrongs: near(r, b, (x) => `${x} years`, 1), explanation: `After ${n} years A is ${a + n}, so B is ${(a + n) / 2}. B's present age = ${(a + n) / 2} − ${n} = ${b}.` };
} };

const permutations: Family = { topic: "Permutations & Combinations", make: (r) => {
  if (r() < 0.5) {
    const k = int(r, 3, 6);
    return { topic: "Permutations & Combinations", difficulty: 2, prompt: `In how many different ways can ${k} people stand in a row?`, correct: String(fact(k)), wrongs: near(r, fact(k), String, 1), explanation: `${k} people can be ordered in ${k}! = ${fact(k)} ways.` };
  }
  const w = pick(r, ["LOGIC", "BRAIN", "PLANT", "TEAM", "CODE", "MIND", "WORK", "SKILL"]);
  const letters = new Set(w).size;
  if (letters !== w.length) return null;
  return { topic: "Permutations & Combinations", difficulty: 2, prompt: `How many different arrangements can be made from all the letters of the word "${w}"?`, correct: String(fact(w.length)), wrongs: near(r, fact(w.length), String, 1), explanation: `All ${w.length} letters are different, so ${w.length}! = ${fact(w.length)}.` };
} };

const combinations: Family = { topic: "Permutations & Combinations", make: (r) => {
  const n = int(r, 5, 12);
  const c = (n * (n - 1)) / 2;
  return { topic: "Permutations & Combinations", difficulty: 2, prompt: `A team of ${n} students must choose 2 of them to represent it. In how many ways can the pair be chosen?`, correct: String(c), wrongs: [String(n * (n - 1)), ...near(r, c, String, 1)], explanation: `Order does not matter: ${n}×${n - 1}/2 = ${c}. (${n * (n - 1)} counts each pair twice.)` };
} };

const probability: Family = { topic: "Probability", make: (r) => {
  const red = int(r, 1, 9);
  const blue = int(r, 1, 9);
  const total = red + blue;
  return { topic: "Probability", difficulty: 2, prompt: `A bag has ${red} red and ${blue} blue balls. One ball is drawn at random. What is the probability that it is red?`, correct: frac(red, total), wrongs: [frac(blue, total), frac(1, total), frac(red, blue)], explanation: `Favourable ${red} out of ${total} balls = ${frac(red, total)}.` };
} };

const FAMILIES: Family[] = [percentOf, percentChange, profitPercent, spFromProfit, discount, successive, ratioShare, averageNew, workTogether, pipes, distance, avgSpeed, train, simpleInterest, compoundInterest, hcf, lcm, remainder9, mixture, ages, permutations, combinations, probability];

/** About 8 questions per family: a bank of 150+ with every answer computed, so none can be wrong. */
export function aptitudeBank(perFamily = 8): BankRow[] {
  return FAMILIES.flatMap((f, i) => collect(rng(1000 + i), "aptitude", perFamily, f.make));
}
