import { describe, expect, it } from "vitest";
import { IntentBodySchema, ResolveSuggestionSchema, GoalTextSchema, validateIntent } from "./intent-rules";

const A = "7f3c1c0e-1c2b-4c9e-9a53-0b6f1d9d2a11";
const B = "0a4d8c6e-2f1b-4b7a-8e39-5d6c7b8a9f10";
const C = "11111111-2222-4333-8444-555555555555";
const active = new Set([A, B]);

describe("validateIntent", () => {
  it("accepts a primary career, with or without a Plan B", () => {
    expect(validateIntent({ primaryCareerId: A, secondaryCareerId: null, isExploring: false }, active)).toEqual({ ok: true });
    expect(validateIntent({ primaryCareerId: A, secondaryCareerId: B, isExploring: false }, active)).toEqual({ ok: true });
  });
  it("accepts 'I am exploring' with no career chosen", () => {
    expect(validateIntent({ primaryCareerId: null, secondaryCareerId: null, isExploring: true }, active)).toEqual({ ok: true });
  });
  it("refuses a Plan B without a primary, the same career twice, and careers that are not active", () => {
    expect(validateIntent({ primaryCareerId: null, secondaryCareerId: B, isExploring: false }, active)).toMatchObject({ ok: false });
    expect(validateIntent({ primaryCareerId: A, secondaryCareerId: A, isExploring: false }, active)).toMatchObject({ ok: false });
    expect(validateIntent({ primaryCareerId: C, secondaryCareerId: null, isExploring: false }, active)).toMatchObject({ ok: false });
    expect(validateIntent({ primaryCareerId: A, secondaryCareerId: C, isExploring: false }, active)).toMatchObject({ ok: false });
  });
});

describe("request schemas", () => {
  it("the intent body is strict and cannot name a student", () => {
    expect(IntentBodySchema.safeParse({ primaryCareerId: A }).success).toBe(true);
    expect(IntentBodySchema.safeParse({ primaryCareerId: null, secondaryCareerId: null, isExploring: true }).success).toBe(true);
    expect(IntentBodySchema.safeParse({ studentId: A, primaryCareerId: A }).success).toBe(false);
    expect(IntentBodySchema.safeParse({ primaryCareerId: "not-a-uuid" }).success).toBe(false);
    expect(IntentBodySchema.safeParse({}).success).toBe(false);
  });
  it("goal text is trimmed and bounded", () => {
    expect(GoalTextSchema.safeParse({ goalText: "  I want to work with data  " }).data?.goalText).toBe("I want to work with data");
    expect(GoalTextSchema.safeParse({ goalText: "ab" }).success).toBe(false);
    expect(GoalTextSchema.safeParse({ goalText: "x".repeat(501) }).success).toBe(false);
  });
  it("resolving a suggestion needs an explicit career when accepting", () => {
    expect(ResolveSuggestionSchema.safeParse({ action: "dismiss" }).success).toBe(true);
    expect(ResolveSuggestionSchema.safeParse({ action: "accept", careerId: A }).success).toBe(true);
    expect(ResolveSuggestionSchema.safeParse({ action: "accept", careerId: A, as: "secondary" }).success).toBe(true);
    expect(ResolveSuggestionSchema.safeParse({ action: "accept" }).success).toBe(false);
    expect(ResolveSuggestionSchema.safeParse({ action: "accept", careerId: A, as: "tertiary" }).success).toBe(false);
  });
});
