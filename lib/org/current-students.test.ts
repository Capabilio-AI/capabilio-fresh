import { describe, expect, it } from "vitest";
import { currentStudentsFilter } from "./current-students";

describe("currentStudentsFilter", () => {
  it("before the new academic year starts, the graduating batch still counts", () => {
    expect(currentStudentsFilter(new Date(2026, 4, 15))).toBe("end_year.is.null,end_year.gt.2026,end_year.eq.2026");
  });
  it("once the new year starts, the batch that ends this year has left", () => {
    expect(currentStudentsFilter(new Date(2026, 9, 31))).toBe("end_year.is.null,end_year.gt.2026");
  });
});
