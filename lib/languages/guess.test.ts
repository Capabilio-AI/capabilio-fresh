import { describe, expect, it } from "vitest";
import { canGuess, sameOutput } from "./guess";

describe("sameOutput", () => {
  it("accepts the same words and numbers, ignoring extra spaces, line ends and blank lines at the ends", () => {
    expect(sameOutput("5 7 7 2", "5 7 7 2\n")).toBe(true);
    expect(sameOutput("  5   7  7 2 ", "5 7 7 2")).toBe(true);
    expect(sameOutput("a\nb\n\n", "a\r\nb\r\n")).toBe(true);
  });
  it("rejects a different answer, a different order, and an empty guess", () => {
    expect(sameOutput("5 7 7 3", "5 7 7 2")).toBe(false);
    expect(sameOutput("7 5", "5 7")).toBe(false);
    expect(sameOutput("Hello", "hello")).toBe(false);
    expect(sameOutput("", "")).toBe(false);
    expect(sameOutput("   ", "\n")).toBe(false);
  });
});

describe("canGuess", () => {
  it("allows runnable examples that print without asking for input", () => {
    expect(canGuess("python", "print(1 + 1)")).toBe(true);
    expect(canGuess("c", "int main(void){ printf(\"hi\"); }")).toBe(true);
    expect(canGuess("java", "System.out.println(2);")).toBe(true);
  });
  it("refuses examples that wait for the student to type, pages, SQL and C#", () => {
    expect(canGuess("python", "n = int(input())")).toBe(false);
    expect(canGuess("c", "scanf(\"%d\", &n);")).toBe(false);
    expect(canGuess("java", "Scanner s = new Scanner(System.in);")).toBe(false);
    expect(canGuess("html", "<p>hi</p>")).toBe(false);
    expect(canGuess("sql", "SELECT 1")).toBe(false);
    expect(canGuess(null, "x")).toBe(false);
  });
});
