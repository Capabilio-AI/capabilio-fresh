import { describe, expect, it } from "vitest";
import { looksLikeCode } from "./CodeText";

describe("looksLikeCode", () => {
  it.each(["SELECT AVG(total) FROM orders WHERE is_returning", "df.groupby('region')['sales'].sum()", "for i in range(3): print(i)", "total = price * qty;"])("treats %s as code", (t) => expect(looksLikeCode(t)).toBe(true));
  it.each(["No error; the sentence is correct", "Subject-verb agreement error", "It is a mistake, however, to ignore it; plan ahead", "pleased"])("keeps %s as prose", (t) => expect(looksLikeCode(t)).toBe(false));
});
