import { collect, int, near, pick, rng, shuffle, type BankRow, type Draft, type Rng } from "./draft";

type Family = { make: (r: Rng) => Draft | null };
const A = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
const shift = (word: string, k: number) => word.split("").map((c) => A[(A.indexOf(c) + k + 26) % 26]).join("");
const T = "Number & Letter Series";
const C = "Coding-Decoding";
const D = "Direction & Ranking";
const S = "Syllogisms";
const L = "Logical Puzzles";

const arithmetic: Family = { make: (r) => {
  const a = int(r, 2, 30), d = int(r, 2, 12);
  const seq = [0, 1, 2, 3, 4].map((i) => a + i * d);
  const next = a + 5 * d;
  return { topic: T, difficulty: 1, prompt: `Find the next number: ${seq.join(", ")}, ?`, correct: String(next), wrongs: near(r, next, String, 1), explanation: `Each term adds ${d}, so the next is ${seq[4]} + ${d} = ${next}.` };
} };

const geometric: Family = { make: (r) => {
  const a = int(r, 1, 6), m = pick(r, [2, 3, 4]);
  const seq = [0, 1, 2, 3].map((i) => a * m ** i);
  const next = a * m ** 4;
  return { topic: T, difficulty: 2, prompt: `Find the next number: ${seq.join(", ")}, ?`, correct: String(next), wrongs: near(r, next, String, 1), explanation: `Each term is multiplied by ${m}: ${seq[3]} × ${m} = ${next}.` };
} };

const growingGap: Family = { make: (r) => {
  const a = int(r, 1, 20), start = pick(r, [1, 2, 3]);
  const seq = [a]; for (let i = 0; i < 4; i++) seq.push(seq[i] + start + i);
  const next = seq[4] + start + 4;
  return { topic: T, difficulty: 2, prompt: `Find the next number: ${seq.join(", ")}, ?`, correct: String(next), wrongs: near(r, next, String, 1), explanation: `The gaps grow by 1 each time (${start}, ${start + 1}, ${start + 2}, ${start + 3}), so the next gap is ${start + 4}: ${seq[4]} + ${start + 4} = ${next}.` };
} };

const squares: Family = { make: (r) => {
  const c = int(r, 0, 9), s = int(r, 1, 6);
  const seq = [0, 1, 2, 3, 4].map((i) => (s + i) ** 2 + c);
  const next = (s + 5) ** 2 + c;
  return { topic: T, difficulty: 3, prompt: `Find the next number: ${seq.join(", ")}, ?`, correct: String(next), wrongs: near(r, next, String, 1), explanation: `The terms are ${[0, 1, 2, 3, 4, 5].map((i) => `${s + i}²${c ? `+${c}` : ""}`).join(", ")}, so the next is ${next}.` };
} };

const letterSeries: Family = { make: (r) => {
  const step = int(r, 2, 4), start = int(r, 0, 8);
  const seq = [0, 1, 2, 3].map((i) => A[start + i * step]);
  const next = A[start + 4 * step];
  const pool = [...A].filter((c) => c !== next);
  return { topic: T, difficulty: 1, prompt: `Find the next letter: ${seq.join(", ")}, ?`, correct: next, wrongs: shuffle(r, pool).slice(0, 3), explanation: `Each letter moves ${step} places forward, so after ${seq[3]} comes ${next}.` };
} };

const codeShift: Family = { make: (r) => {
  const words = ["CAT", "DOG", "SUN", "MAP", "PEN", "BOX", "CAR", "FAN", "KEY", "BAG", "TEA", "HAT"];
  const [w1, w2] = shuffle(r, words);
  const k = int(r, 1, 4);
  const ans = shift(w2, k);
  return { topic: C, difficulty: 2, prompt: `In a certain code, ${w1} is written as ${shift(w1, k)}. How is ${w2} written in that code?`, correct: ans, wrongs: [shift(w2, k + 1), shift(w2, k - 1), shift(w2, -k)], explanation: `Every letter moves ${k} place${k > 1 ? "s" : ""} forward: ${w2} → ${ans}.` };
} };

const reverseCode: Family = { make: (r) => {
  const w = pick(r, ["PLANET", "SILVER", "MARKET", "BRIDGE", "GARDEN", "WINDOW", "FLIGHT", "STREAM"]);
  const rev = [...w].reverse().join("");
  return { topic: C, difficulty: 1, prompt: `If "${w}" is coded by writing its letters in reverse order, how is it written?`, correct: rev, wrongs: [shift(w, 1), w.slice(1) + w[0], w.slice(0, 3) + [...w.slice(3)].reverse().join("")], explanation: `Reading ${w} backwards gives ${rev}.` };
} };

const turns: Family = { make: (r) => {
  const x = int(r, 3, 12), y = int(r, 2, 9);
  const dirs = [["north", "east"], ["south", "west"], ["east", "south"], ["west", "north"]] as const;
  const [first, second] = pick(r, dirs);
  const opposite = { north: "south", south: "north", east: "west", west: "east" } as const;
  const dist = y;
  const heading = second;
  return { topic: D, difficulty: 2, prompt: `Ravi walks ${x} km ${first}, then ${y} km ${second}, then ${x} km ${opposite[first]}. How far is he from his starting point, and in which direction?`, correct: `${dist} km ${heading}`, wrongs: [`${x + y} km ${heading}`, `${dist} km ${opposite[heading]}`, `${x} km ${first}`], explanation: `The ${first}/${opposite[first]} legs cancel out, leaving ${y} km ${second}.` };
} };

const rankRow: Family = { make: (r) => {
  const n = int(r, 15, 45), p = int(r, 4, n - 4), q = n + 1 - p;
  return { topic: D, difficulty: 1, prompt: `In a row of students, Anu is ${p}th from the left and ${q}th from the right. How many students are in the row?`, correct: String(n), wrongs: [String(p + q), ...near(r, n, String, 1)], explanation: `Total = ${p} + ${q} − 1 = ${n}. Anu is counted from both ends, so subtract 1.` };
} };

const weekday: Family = { make: (r) => {
  const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
  const i = int(r, 0, 6), n = int(r, 10, 90);
  const ans = days[(i + n) % 7];
  return { topic: L, difficulty: 2, prompt: `Today is ${days[i]}. What day of the week will it be after ${n} days?`, correct: ans, wrongs: days.filter((d) => d !== ans).slice(0, 5), explanation: `${n} = ${Math.floor(n / 7)} weeks + ${n % 7} day${n % 7 === 1 ? "" : "s"}. Counting ${n % 7} forward from ${days[i]} gives ${ans}.` };
} };

const analogy: Family = { make: (r) => {
  const power = pick(r, [2, 3]);
  const a = int(r, 2, 6), b = int(r, 7, 12);
  const name = power === 2 ? "squares" : "cubes";
  return { topic: L, difficulty: 1, prompt: `${a} : ${a ** power} :: ${b} : ?`, correct: String(b ** power), wrongs: [String(b * power), String(b ** (power === 2 ? 3 : 2)), String(b ** power + b)], explanation: `The second number is the ${name.slice(0, -1)} of the first, so ${b}${power === 2 ? "²" : "³"} = ${b ** power}.` };
} };

const oddOneOut: Family = { make: (r) => {
  const k = pick(r, [3, 4, 5, 6, 7, 9]);
  const m = shuffle(r, [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]).slice(0, 3).map((x) => x * k);
  let odd = int(r, 10, 80);
  while (odd % k === 0) odd++;
  return { topic: L, difficulty: 1, prompt: `Which number does not belong with the others: ${shuffle(r, [...m, odd]).join(", ")}?`, correct: String(odd), wrongs: m.map(String), explanation: `${m.join(", ")} are all multiples of ${k}; ${odd} is not.` };
} };

const FORMS = [
  { s: (a: string, b: string, c: string) => [`All ${a} are ${b}.`, `All ${b} are ${c}.`], c: (a: string, _b: string, c: string) => [`All ${a} are ${c}.`, `Some ${c} are ${a}.`], ans: "Both follow", why: "Everything in the first group is in the second, and everything in the second is in the third, so all of the first are in the third. The first group has members, so some of the third are in it." },
  { s: (a: string, b: string, c: string) => [`All ${a} are ${b}.`, `Some ${b} are ${c}.`], c: (a: string, _b: string, c: string) => [`Some ${a} are ${c}.`, `All ${c} are ${a}.`], ans: "Neither follows", why: "The ${c} that are ${b} may not be the ones that are ${a}, so neither conclusion is forced." },
  { s: (a: string, b: string, c: string) => [`Some ${a} are ${b}.`, `All ${b} are ${c}.`], c: (a: string, _b: string, c: string) => [`Some ${a} are ${c}.`, `All ${a} are ${c}.`], ans: "Only I follows", why: "The ${a} that are ${b} must be ${c}, so some of them are. Nothing says all of them are." },
  { s: (a: string, b: string, c: string) => [`No ${a} is ${b}.`, `All ${c} are ${a}.`], c: (_a: string, b: string, c: string) => [`No ${c} is ${b}.`, `Some ${b} are ${c}.`], ans: "Only I follows", why: "Every ${c} is an ${a}, and no ${a} is a ${b}, so no ${c} is a ${b}. That rules out the second conclusion." },
] as const;

const NOUNS = [["pens", "books", "tables"], ["cats", "animals", "birds"], ["roses", "flowers", "plants"], ["doctors", "graduates", "teachers"], ["cars", "vehicles", "engines"], ["laptops", "machines", "phones"], ["players", "athletes", "students"], ["apples", "fruits", "vegetables"], ["pilots", "engineers", "workers"], ["rivers", "lakes", "streams"]] as const;

const syllogism: Family = { make: (r) => {
  const form = pick(r, FORMS);
  const [a, b, c] = shuffle(r, pick(r, NOUNS));
  const why = form.why.replace(/\$\{a\}/g, a).replace(/\$\{b\}/g, b).replace(/\$\{c\}/g, c);
  const [s1, s2] = form.s(a, b, c);
  const [c1, c2] = form.c(a, b, c);
  return { topic: S, difficulty: 3, prompt: `Statements: ${s1} ${s2}\nConclusions: I. ${c1}  II. ${c2}\nWhich of these is correct?`, correct: form.ans, wrongs: ["Only I follows", "Only II follows", "Both follow", "Neither follows"].filter((x) => x !== form.ans), explanation: why };
} };

/** Blood relations are written out: the chain of reasoning is the point, and a template would invent impossible families. */
const RELATIONS: [string, string, string[], string][] = [
  ["Pointing to a photograph, Meera says, \"He is the son of my mother's only brother.\" How is he related to Meera?", "Cousin", ["Brother", "Uncle", "Nephew"], "Her mother's brother is her maternal uncle; his son is her cousin."],
  ["A says, \"B is the son of my father's only son.\" How is B related to A?", "Son", ["Brother", "Nephew", "Cousin"], "A's father's only son is A himself, so B is A's son."],
  ["Pointing to a girl, Ramesh says, \"She is the daughter of my wife's mother's only son.\" How is the girl related to Ramesh?", "Wife's niece", ["Sister", "Daughter", "Wife"], "His wife's mother's only son is his wife's brother, so the girl is the daughter of his wife's brother."],
  ["P is the brother of Q. Q is the sister of R. R is the father of S. How is P related to S?", "Uncle", ["Father", "Brother", "Cousin"], "P and R are brothers (Q's siblings), so P is the brother of S's father: an uncle."],
  ["If A is the mother of B, and B is the sister of C, then how is C related to A?", "Child", ["Sibling", "Mother", "Grandchild"], "B and C are siblings, so C is also A's child."],
  ["Introducing a man, a woman says, \"His mother is the only daughter of my mother.\" How is the woman related to the man?", "Mother", ["Sister", "Aunt", "Grandmother"], "The only daughter of her mother is herself, so she is his mother."],
  ["X is Y's brother. Y is Z's mother. How is Z related to X?", "Nephew or niece", ["Son", "Brother", "Cousin"], "Y is X's sister, so Y's child Z is X's sister's child: a nephew or niece."],
  ["Pointing to a boy, Kiran says, \"He is the brother of my mother's sister's daughter.\" How is the boy related to Kiran?", "Cousin", ["Brother", "Uncle", "Nephew"], "His mother's sister's daughter is his cousin, and her brother is also his cousin."],
];

const blood: Family = { make: (r) => {
  const [prompt, correct, wrongs, why] = pick(r, RELATIONS);
  return { topic: "Blood Relations", difficulty: 2, prompt, correct, wrongs: [...wrongs], explanation: why };
} };

const FAMILIES: { f: Family; count: number }[] = [
  { f: arithmetic, count: 8 }, { f: geometric, count: 8 }, { f: growingGap, count: 8 }, { f: squares, count: 6 }, { f: letterSeries, count: 8 },
  { f: codeShift, count: 10 }, { f: reverseCode, count: 6 }, { f: turns, count: 10 }, { f: rankRow, count: 10 }, { f: weekday, count: 10 },
  { f: analogy, count: 8 }, { f: oddOneOut, count: 8 }, { f: syllogism, count: 12 }, { f: blood, count: 8 },
];

export function reasoningBank(): BankRow[] {
  return FAMILIES.flatMap(({ f, count }, i) => collect(rng(2000 + i), "reasoning", count, f.make));
}
