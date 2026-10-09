import { describe, expect, it } from "vitest";
import { contentHash, validateQuestion, type Expectation } from "./validate";

const expect_: Expectation = { skillKey: "SKILL_SQL", careerKey: "data-analyst", difficulty: "MEDIUM", minQuestionLength: 60 };
const good = {
  question: "A marketing manager wants the average basket value for returning customers. Which query is correct?",
  options: ["SELECT AVG(total) FROM orders WHERE is_returning", "SELECT SUM(total) FROM orders", "SELECT COUNT(*) FROM orders", "SELECT MAX(total) FROM orders"],
  skill: "SQL", skillId: "SKILL_SQL", careerRole: "Data Analyst", difficulty: "MEDIUM", type: "sql_query",
  correctAnswer: "SELECT AVG(total) FROM orders WHERE is_returning",
  explanation: "AVG over the filtered rows gives the mean basket value; the others compute a sum, a count or a maximum.",
  estimatedTimeSeconds: 60,
};

describe("validateQuestion", () => {
  it("accepts a well-formed question and resolves the correct index", () => {
    const v = validateQuestion(good, expect_);
    expect(v.ok && v.question.correctIndex).toBe(0);
  });
  it.each([
    ["missing fields", { question: "short" }],
    ["wrong option count", { ...good, options: good.options.slice(0, 3) }],
    ["duplicate options", { ...good, options: [good.options[0], good.options[0], good.options[2], good.options[3]] }],
    ["answer not among options", { ...good, correctAnswer: "SELECT 1" }],
    ["all of the above", { ...good, options: [...good.options.slice(0, 3), "All of the above"] }],
    ["wrong skill", { ...good, skillId: "SKILL_PYTHON" }],
    ["wrong difficulty", { ...good, difficulty: "HARD" }],
    ["unknown type", { ...good, type: "essay" }],
    ["definition-length stem", { ...good, question: "What is SQL as a language used for data?" }],
  ])("rejects %s", (_name, bad) => {
    expect(validateQuestion(bad, expect_).ok).toBe(false);
  });
  it("rejects a non-object", () => {
    expect(validateQuestion("nonsense", expect_).ok).toBe(false);
    expect(validateQuestion(null, expect_).ok).toBe(false);
  });
});

describe("contentHash", () => {
  it("ignores case, spacing and punctuation but not the skill", () => {
    expect(contentHash("Which  query is   correct?", "SKILL_SQL")).toBe(contentHash("which query is correct", "skill_sql"));
    expect(contentHash("Which query is correct?", "SKILL_SQL")).not.toBe(contentHash("Which query is correct?", "SKILL_PYTHON"));
  });
});

describe("position references", () => {
  it.each(["Option 2 lacks DISTINCT, so duplicates remain in the output.", "Choice B is wrong because it omits GROUP BY.", "Only option (c) aggregates correctly."])("rejects an explanation that says %s", (explanation) => {
    expect(validateQuestion({ ...good, explanation }, expect_).ok).toBe(false);
  });
});
