import { describe, expect, it } from "vitest";
import { workstationCareer } from "./workstation-career";

const ref = (name: string) => ({ id: name, key: name, name });

describe("workstationCareer", () => {
  it("follows the career the student chose, not an older free-text answer", () => {
    expect(workstationCareer({ primary: ref("Software Engineer"), secondary: null, planBKind: null }, "data analyst")).toBe("Software Engineer");
  });
  it("always follows the main career: a role change in Plan B already made the new role the main one", () => {
    expect(workstationCareer({ primary: ref("Data Analyst"), secondary: ref("Software Engineer"), planBKind: "change_role" }, null)).toBe("Data Analyst");
    expect(workstationCareer({ primary: ref("Software Engineer"), secondary: ref("Data Analyst"), planBKind: "same_role" }, null)).toBe("Software Engineer");
  });
  it("falls back to the free-text answer only when no career was chosen", () => {
    expect(workstationCareer({ primary: null, secondary: null, planBKind: null }, "devops engineer")).toBe("devops engineer");
    expect(workstationCareer({ primary: null, secondary: null, planBKind: null }, null)).toBeNull();
  });
});
