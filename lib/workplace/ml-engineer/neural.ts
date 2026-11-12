import type { Rng } from "../rng";
import { MAX_SUBMISSIONS, MlRejected, type MlDraft, type Texts } from "../ml/tickets";

// Neural-network basics, as numbers a NumPy notebook can produce by hand: a forward pass through a tiny network and one backpropagation step.
// No deep-learning framework is involved; the point is to prove the student understands what the framework computes. Every answer is computed here.

const round = (v: number, d: number) => Math.round(v * 10 ** d) / 10 ** d;
const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));
const relu = (z: number) => Math.max(0, z);
const w = (rng: Rng) => round((rng.next() - 0.5) * 2, 2);
const lit = (m: number[][]) => `np.array(${JSON.stringify(m)})`;

/** Forward pass of a 2-3-1 network (ReLU hidden layer, sigmoid output) on three samples, and the mean binary cross-entropy. */
export function buildForwardPass(rng: Rng, texts: Texts): MlDraft {
  const x = Array.from({ length: 3 }, () => [round(rng.next() * 4 - 1, 1), round(rng.next() * 4 - 1, 1)]);
  const y = [rng.int(0, 1), rng.int(0, 1), rng.int(0, 1)];
  const w1 = Array.from({ length: 2 }, () => Array.from({ length: 3 }, () => w(rng)));
  const b1 = Array.from({ length: 3 }, () => w(rng));
  const w2 = Array.from({ length: 3 }, () => w(rng));
  const b2 = w(rng);
  const hidden = x.map((row) => [0, 1, 2].map((j) => relu(row[0] * w1[0][j] + row[1] * w1[1][j] + b1[j])));
  const p = hidden.map((h) => sigmoid(h[0] * w2[0] + h[1] * w2[1] + h[2] * w2[2] + b2));
  const loss = -p.reduce((s, pi, i) => s + (y[i] ? Math.log(pi) : Math.log(1 - pi)), 0) / p.length;
  const hiddenSum = hidden[0].reduce((s, v) => s + v, 0);
  if (hidden[0].every((v) => v === 0) || hidden.every((h) => h.every((v) => v > 0))) throw new MlRejected("ReLU does nothing in this draw");
  return {
    title: texts.title, requester: texts.requester, scenario: texts.scenario,
    skillTags: ["Neural networks", "Forward pass", "Cross-entropy", "NumPy"],
    content: {
      company: texts.company, kind: "numbers", files: [],
      starter: `import numpy as np

X = ${lit(x)}          # 3 samples, 2 features
y = np.array(${JSON.stringify(y)})                  # true labels
W1 = ${lit(w1)}         # 2 inputs -> 3 hidden units
b1 = np.array(${JSON.stringify(b1)})
W2 = np.array(${JSON.stringify(w2)})                # 3 hidden units -> 1 output
b2 = ${b2}

# hidden = ReLU(X @ W1 + b1)    output p = sigmoid(hidden @ W2 + b2)
# loss = mean binary cross-entropy = -mean(y * ln(p) + (1 - y) * ln(1 - p))
`,
      fields: [
        { key: "hidden_sum", label: "Sum of the 3 hidden activations for the first sample", help: "After ReLU. Three decimals." },
        { key: "p1", label: "Output p for the first sample", help: "Three decimals." },
        { key: "p2", label: "Output p for the second sample", help: "Three decimals." },
        { key: "p3", label: "Output p for the third sample", help: "Three decimals." },
        { key: "loss", label: "Mean binary cross-entropy over the 3 samples", help: "Three decimals." },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Run the forward pass by hand in NumPy and report the five numbers.",
    },
    key: { kind: "numbers", expected: { hidden_sum: round(hiddenSum, 3), p1: round(p[0], 3), p2: round(p[1], 3), p3: round(p[2], 3), loss: round(loss, 3) }, tolerance: { hidden_sum: 0.0015, p1: 0.0015, p2: 0.0015, p3: 0.0015, loss: 0.0015 } },
  };
}

const LEARNING_RATE = 0.1;

/** One backpropagation step on a single sample through x -> ReLU(w1*x + b1) -> sigmoid(w2*h + b2). */
export function buildBackpropStep(rng: Rng, texts: Texts): MlDraft {
  const x = round(0.5 + rng.next() * 2, 1);
  const y = rng.int(0, 1);
  const [w1, b1, w2, b2] = [round(0.3 + rng.next(), 2), w(rng), round((rng.next() - 0.5) * 2, 2), w(rng)];
  const h = relu(w1 * x + b1);
  if (h <= 0.05 || Math.abs(w2) < 0.1) throw new MlRejected("the hidden unit is inactive");
  const p = sigmoid(w2 * h + b2);
  const dz = p - y;
  const grads = { dw2: dz * h, db2: dz, dw1: dz * w2 * x, db1: dz * w2 };
  return {
    title: texts.title, requester: texts.requester, scenario: texts.scenario,
    skillTags: ["Neural networks", "Backpropagation", "Chain rule", "NumPy"],
    content: {
      company: texts.company, kind: "numbers", files: [],
      starter: `import numpy as np

x, y = ${x}, ${y}                 # one training sample
w1, b1 = ${w1}, ${b1}            # hidden unit: h = ReLU(w1 * x + b1)
w2, b2 = ${w2}, ${b2}            # output: p = sigmoid(w2 * h + b2)
LR = ${LEARNING_RATE}

# loss = binary cross-entropy of p against y. For a sigmoid output, d loss / d z = p - y,
# where z = w2 * h + b2. Use the chain rule back through h (ReLU is 1 when its input is positive).
`,
      fields: [
        { key: "p", label: "Output p before the step", help: "Four decimals." },
        { key: "dw2", label: "Gradient of the loss with respect to w2", help: "Four decimals." },
        { key: "dw1", label: "Gradient of the loss with respect to w1", help: "Four decimals." },
        { key: "w2_new", label: "w2 after one gradient descent step", help: "w2 - LR * gradient. Four decimals." },
        { key: "w1_new", label: "w1 after one gradient descent step", help: "Four decimals." },
      ],
      maxSubmissions: MAX_SUBMISSIONS, deliverable: "Backpropagate one step by hand and report the five numbers.",
    },
    key: { kind: "numbers", expected: { p: round(p, 4), dw2: round(grads.dw2, 4), dw1: round(grads.dw1, 4), w2_new: round(w2 - LEARNING_RATE * grads.dw2, 4), w1_new: round(w1 - LEARNING_RATE * grads.dw1, 4) }, tolerance: { p: 0.0006, dw2: 0.0006, dw1: 0.0006, w2_new: 0.0006, w1_new: 0.0006 } },
  };
}
