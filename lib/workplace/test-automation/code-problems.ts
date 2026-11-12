import type { Rng } from "../rng";
import { problem } from "../application-developer/code-problems";

/**
 * Software Test Automation Engineer tickets for the shared code workstation: the small helpers a QA automation fresher writes around a test suite
 * (test data, boundary cases, result summaries, flaky-test detection). The student's function runs in their browser; the server compares what it
 * returned with the answers below. No real test runner is involved.
 */
const CAST = {
  qa: { name: "Joseph Thomas", title: "QA Lead" },
  dev: { name: "Aditya Rao", title: "Tech Lead" },
  release: { name: "Neha Kulkarni", title: "Release Manager" },
};

// ---- sta-test-data ----
const uniqueEmails = (count: number, prefix: string) => Array.from({ length: Math.max(0, count) }, (_, i) => `${prefix.trim().toLowerCase()}${i + 1}@test.example`);

const boundaryValues = (min: number, max: number) => [...new Set([min - 1, min, min + 1, max - 1, max, max + 1])].sort((a, b) => a - b);

// ---- sta-report-analysis ----
type Result = { name: string; status: string; duration_ms: number };
const summarizeResults = (results: Result[]) => {
  const count = (s: string) => results.filter((r) => r.status === s).length;
  const passed = count("passed");
  const failed = count("failed");
  const ran = passed + failed;
  let slowest: string | null = null;
  let best = -1;
  for (const r of results) {
    if (r.status !== "skipped" && r.duration_ms > best) {
      best = r.duration_ms;
      slowest = r.name;
    }
  }
  return { total: results.length, passed, failed, skipped: count("skipped"), pass_rate: ran === 0 ? 0 : Math.round((1000 * passed) / ran) / 10, slowest };
};

const failuresByFile = (lines: string[]) => {
  const counts = new Map<string, number>();
  for (const line of lines) {
    const m = /^FAIL (\S+?)::/.exec(line);
    if (m) counts.set(m[1], (counts.get(m[1]) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
};

// ---- sta-flaky-tests ----
type Run = { test: string; passed: boolean };
const sortedNames = (names: Iterable<string>) => [...names].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
const outcomes = (runs: Run[]) => {
  const by = new Map<string, { pass: number; fail: number }>();
  for (const r of runs) {
    const o = by.get(r.test) ?? { pass: 0, fail: 0 };
    if (r.passed) o.pass++;
    else o.fail++;
    by.set(r.test, o);
  }
  return by;
};
const findFlaky = (runs: Run[]) => sortedNames([...outcomes(runs)].filter(([, o]) => o.pass > 0 && o.fail > 0).map(([t]) => t));
const flakyRates = (runs: Run[]) =>
  [...outcomes(runs)]
    .filter(([, o]) => o.pass > 0 && o.fail > 0)
    .map(([test, o]) => ({ test, fail_rate: Math.round((100 * o.fail) / (o.pass + o.fail)) / 100 }))
    .sort((a, b) => b.fail_rate - a.fail_rate || (a.test < b.test ? -1 : a.test > b.test ? 1 : 0));

const TESTS = ["test_login", "test_cart_total", "test_checkout", "test_search", "test_profile", "test_logout", "test_refund"];
const FILES = ["tests/test_cart.py", "tests/test_login.py", "tests/test_search.py", "tests/test_refund.py"];

const resultsCase = (rng: Rng): Result[] =>
  Array.from({ length: rng.int(3, 8) }, (_, i) => ({ name: `${rng.pick(TESTS)}_${i}`, status: rng.weighted([["passed", 6], ["failed", 2], ["skipped", 1]]), duration_ms: rng.int(1, 40) * 25 }));
const logCase = (rng: Rng): string[] =>
  Array.from({ length: rng.int(2, 9) }, (_, i) => {
    const kind = rng.weighted([["fail", 5], ["pass", 4], ["noise", 1]]);
    if (kind === "fail") return `FAIL ${rng.pick(FILES)}::${rng.pick(TESTS)}_${i} - AssertionError: expected ${rng.int(1, 9)} got ${rng.int(1, 9)}`;
    if (kind === "pass") return `PASS ${rng.pick(FILES)}::${rng.pick(TESTS)}_${i}`;
    return rng.pick(["collected 12 items", "=== 3 failed, 9 passed in 4.20s ===", "FAILED (see report)"]);
  });
const runsCase = (rng: Rng): Run[] => {
  const names = rng.shuffle(TESTS).slice(0, rng.int(2, 4));
  return Array.from({ length: rng.int(6, 14) }, () => ({ test: rng.pick(names), passed: rng.chance(0.65) }));
};

export const TEST_AUTOMATION_CODE_PROBLEMS = [
  problem({
    id: "sta-unique-emails", area: "sta-test-data", difficulty: "easy", minLevel: "fresher", fn: "unique_emails", params: ["count", "prefix"], requester: CAST.qa,
    title: "Fresh signup emails for every test run",
    scenario: "Hi, our signup tests all use the same email, so the second run fails with 'email already registered' unless someone cleans the database by hand. I want each test to ask for its own emails that are guaranteed different from each other.",
    deliverable: "Write unique_emails(count, prefix) returning a list of count emails: the prefix trimmed and in lower case, then the number 1, 2, 3 ... then @test.example. For example unique_emails(2, ' Signup ') returns [\"signup1@test.example\", \"signup2@test.example\"]. A count of 0 or less returns an empty list.",
    tags: ["Test data", "Strings", "Lists"],
    cases: (rng) => [[2, " Signup "], [0, "a"], [-3, "a"], [1, "QA"], ...Array.from({ length: 6 }, () => [rng.int(0, 7), rng.pick(["signup", " Checkout ", "REFUND", "qa.bot"])])],
    solve: uniqueEmails as never,
  }),
  problem({
    id: "sta-boundary-values", area: "sta-test-data", difficulty: "medium", minLevel: "fresher", fn: "boundary_values", params: ["min_value", "max_value"], requester: CAST.qa,
    title: "Boundary test values for a numeric field",
    scenario: "Hello, the age field accepts 18 to 60. Our manual tester always tries 18 and 60 but forgets the values just outside and just inside. I would like a helper that gives every automated range test the same boundary values.",
    deliverable: "Write boundary_values(min_value, max_value) for whole numbers with min_value <= max_value. Return the sorted list, without repeats, of min-1, min, min+1, max-1, max and max+1. When the range is tiny some of these are the same number and appear once, for example boundary_values(5, 6) returns [4, 5, 6, 7].",
    tags: ["Boundary value analysis", "Test design", "Sets"],
    cases: (rng) => [[18, 60], [5, 6], [5, 5], [0, 100], ...Array.from({ length: 6 }, () => { const lo = rng.int(-5, 20); return [lo, lo + rng.int(0, 5)]; })],
    solve: boundaryValues as never,
  }),
  problem({
    id: "sta-summarize-results", area: "sta-report-analysis", difficulty: "easy", minLevel: "fresher", fn: "summarize_results", params: ["results"], requester: CAST.release,
    title: "One-line summary of a test run for the release channel",
    scenario: "Hi, before each release I paste the test results into the channel by hand and sometimes miscount. Please give me a function that turns the list of results into the numbers I post. Skipped tests did not run, so they must not drag the pass rate down.",
    deliverable: "Write summarize_results(results). Each result is {name, status, duration_ms} with status 'passed', 'failed' or 'skipped'. Return {total, passed, failed, skipped, pass_rate, slowest}: total counts all results, pass_rate is passed as a percentage of the tests that ran (passed + failed) rounded to 1 decimal place (0 when none ran), and slowest is the name of the longest test that ran, the first one when tied (null when none ran).",
    tags: ["Test reports", "Aggregation", "Edge cases"],
    cases: (rng) => [[[]], [[{ name: "a", status: "skipped", duration_ms: 900 }]], [[{ name: "a", status: "passed", duration_ms: 100 }, { name: "b", status: "failed", duration_ms: 100 }, { name: "c", status: "skipped", duration_ms: 5000 }]], [[{ name: "x", status: "passed", duration_ms: 50 }, { name: "y", status: "passed", duration_ms: 50 }, { name: "z", status: "failed", duration_ms: 20 }]], ...Array.from({ length: 6 }, () => [resultsCase(rng)])],
    solve: summarizeResults as never,
  }),
  problem({
    id: "sta-failures-by-file", area: "sta-report-analysis", difficulty: "medium", minLevel: "fresher", fn: "failures_by_file", params: ["lines"], requester: CAST.dev,
    title: "Which test file is failing the most?",
    scenario: "Hi, the CI log has thousands of lines and I want to know which test file to look at first. Failed tests are logged as 'FAIL path::test_name - message', passes as 'PASS path::test_name', and there is other noise too.",
    deliverable: "Write failures_by_file(lines): count the lines that start with 'FAIL ' followed by a file path, then '::'. Return a list of [path, count] pairs, the file with the most failures first and ties in alphabetical order of path. Lines that do not start with 'FAIL ' (PASS lines, summaries, noise) are ignored.",
    tags: ["Log parsing", "Test reports", "Sorting"],
    cases: (rng) => [[[]], [["PASS tests/a.py::t1", "collected 2 items"]], [["FAIL tests/b.py::t1 - boom", "FAIL tests/a.py::t2 - boom", "FAIL tests/b.py::t3 - boom"]], [["FAIL tests/z.py::t - x", "FAIL tests/a.py::t - x"]], ...Array.from({ length: 6 }, () => [logCase(rng)])],
    solve: failuresByFile as never,
  }),
  problem({
    id: "sta-find-flaky", area: "sta-flaky-tests", difficulty: "easy", minLevel: "fresher", fn: "find_flaky", params: ["runs"], requester: CAST.qa,
    title: "List the flaky tests from repeated runs",
    scenario: "Hello, we reran the same commit several times and some tests passed in one run and failed in another with no code change. Those are flaky and need quarantining. A test that always fails is a real bug, not flaky, and a test that always passes is fine.",
    deliverable: "Write find_flaky(runs). Each run is {test, passed} with passed true or false, and one test can appear many times. Return the sorted list of test names that have at least one pass and at least one fail.",
    tags: ["Flaky tests", "Grouping", "Test reliability"],
    cases: (rng) => [[[]], [[{ test: "a", passed: true }, { test: "a", passed: false }]], [[{ test: "a", passed: false }, { test: "a", passed: false }, { test: "b", passed: true }]], [[{ test: "z", passed: true }, { test: "z", passed: false }, { test: "m", passed: false }, { test: "m", passed: true }]], ...Array.from({ length: 6 }, () => [runsCase(rng)])],
    solve: findFlaky as never,
  }),
  problem({
    id: "sta-flaky-rates", area: "sta-flaky-tests", difficulty: "medium", minLevel: "fresher", fn: "flaky_rates", params: ["runs"], requester: CAST.dev,
    title: "Rank flaky tests by how often they fail",
    scenario: "Hi, we can only fix a few flaky tests this sprint. Please rank them so we start with the ones that fail most often, because those block the most merges.",
    deliverable: "Write flaky_rates(runs) using the same runs as before ({test, passed}). For each flaky test (at least one pass and one fail) return {test, fail_rate}, where fail_rate is failed runs divided by all runs of that test, rounded to 2 decimal places (0.4 means 40%). Put the highest fail_rate first and break ties by test name in alphabetical order. Tests that never failed or never passed are left out.",
    tags: ["Flaky tests", "Rates", "Sorting"],
    cases: (rng) => [[[]], [[{ test: "a", passed: true }, { test: "a", passed: false }, { test: "a", passed: false }]], [[{ test: "b", passed: true }, { test: "b", passed: false }, { test: "a", passed: false }, { test: "a", passed: true }]], ...Array.from({ length: 7 }, () => [runsCase(rng)])],
    solve: flakyRates as never,
  }),
];
