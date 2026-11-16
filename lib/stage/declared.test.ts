import { describe, expect, it } from "vitest";
import { declaredJob } from "./declared";

describe("declaredJob", () => {
  it("reads employer and title for a professional sign-up and tidies whitespace", () => {
    expect(declaredJob({ intent: "professional", employer_name: "  Northwind   Systems ", job_title: "Engineering Manager" })).toEqual({ employerName: "Northwind Systems", jobTitle: "Engineering Manager" });
  });
  it("is null without the professional intent, or when either part is missing or not text", () => {
    expect(declaredJob({ employer_name: "A", job_title: "B" })).toBeNull();
    expect(declaredJob({ intent: "professional", employer_name: "A" })).toBeNull();
    expect(declaredJob({ intent: "professional", employer_name: "A", job_title: 5 })).toBeNull();
    expect(declaredJob(null)).toBeNull();
  });
  it("caps each part at 120 characters", () => {
    const j = declaredJob({ intent: "professional", employer_name: "x".repeat(300), job_title: "y" });
    expect(j?.employerName).toHaveLength(120);
  });
});
