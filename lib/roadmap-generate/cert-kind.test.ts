import { describe, expect, it } from "vitest";
import { certKind } from "./cert-kind";

describe("certKind", () => {
  it("calls vendor exams exams", () => {
    expect(certKind({ provider: "Microsoft", url: "https://learn.microsoft.com/credentials/certifications/azure-data-scientist/" })).toBe("exam");
    expect(certKind({ provider: "Databricks", url: "https://www.databricks.com/learn/certification/machine-learning-associate" })).toBe("exam");
  });
  it("calls course-platform certificates courses, by provider or by link", () => {
    expect(certKind({ provider: "IBM via Coursera", url: null })).toBe("course");
    expect(certKind({ provider: "Google", url: "https://www.coursera.org/professional-certificates/google-data-analytics" })).toBe("course");
    expect(certKind({ provider: "Udemy", url: "https://udemy.com/x" })).toBe("course");
  });
});
