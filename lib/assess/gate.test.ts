import { describe, expect, it } from "vitest";
import { studentGate } from "./gate";
import type { Db } from "./db";

/** A tiny stand-in for the two tables the gate reads. */
function fakeDb(profile: { primary_role: string; student_status: string } | null, status: string | null): Db {
  return {
    from: (table: string) => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: table === "profiles" ? profile : status ? { status } : null }),
        }),
      }),
      upsert: async () => ({}),
    }),
  } as unknown as Db;
}

describe("studentGate", () => {
  it("locks a current student until the profile is ready", async () => {
    expect(await studentGate(fakeDb({ primary_role: "student", student_status: "student" }, "ASSESSMENT_REQUIRED"), "u")).toMatchObject({ locked: true, graduate: false });
    expect(await studentGate(fakeDb({ primary_role: "student", student_status: "student" }, "PROFILE_READY"), "u")).toMatchObject({ locked: false });
  });
  it("never locks a recently graduated account, but reports where they are so the banner can nudge", async () => {
    expect(await studentGate(fakeDb({ primary_role: "student", student_status: "graduate" }, "ASSESSMENT_REQUIRED"), "u")).toEqual({ locked: false, status: "ASSESSMENT_REQUIRED", graduate: true });
  });
  it("never gates other roles", async () => {
    expect(await studentGate(fakeDb({ primary_role: "tpo", student_status: "student" }, null), "u")).toEqual({ locked: false, status: null, graduate: false });
  });
});
