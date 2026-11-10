import { describe, expect, it } from "vitest";
import { rapidSolves, similarity } from "./similarity";

const solution = `#include <stdio.h>
int main() {
    int n, sum = 0;
    scanf("%d", &n);
    for (int i = 1; i <= n; i++) {
        if (i % 2 == 0) { sum += i * i; }
    }
    printf("%d\\n", sum);
    return 0;
}`;

describe("similarity", () => {
  it("treats a copy with renamed variables and new comments as nearly identical", () => {
    const copy = solution.replace(/\bn\b/g, "limit").replace(/\bsum\b/g, "total").replace(/\bi\b/g, "k") + "\n// my own solution";
    expect(similarity(solution, copy)).toBeGreaterThan(0.85);
  });

  it("scores a different approach low", () => {
    const other = `#include <stdio.h>
int main() {
    int count, result = 0, value;
    scanf("%d", &count);
    while (count > 0) {
        value = count;
        if (value % 2 == 0) result = result + value * value;
        count = count - 1;
    }
    printf("%d\\n", result);
    return 0;
}`;
    expect(similarity(solution, other)).toBeLessThan(0.85);
  });

  it("says nothing about answers too short to compare", () => {
    expect(similarity("SELECT 1;", "SELECT 1;")).toBeNull();
  });
});

describe("rapidSolves", () => {
  const sec = (n: number) => n * 1000;
  it("flags three solves within a minute of each other", () => {
    expect(rapidSolves([0, sec(20), sec(45), sec(900)])).toBe(3);
  });
  it("does not flag solves spread out over time", () => {
    expect(rapidSolves([0, sec(300), sec(700), sec(1500)])).toBe(0);
  });
  it("does not flag a pair", () => {
    expect(rapidSolves([0, sec(10)])).toBe(0);
  });
});
