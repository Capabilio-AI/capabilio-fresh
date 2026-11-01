import { describe, expect, it } from "vitest";
import { tokenizeSql } from "./sql-highlight";

describe("tokenizeSql", () => {
  it("never loses or reorders text, so the overlay stays aligned with the textarea", () => {
    const sql = "-- top cities\nSELECT city, SUM(total) AS t\nFROM orders WHERE status = 'it''s' AND qty >= 10.5;\n";
    expect(tokenizeSql(sql).map((t) => t.text).join("")).toBe(sql);
  });

  it("marks keywords, strings, numbers and comments, and leaves identifiers plain", () => {
    const kinds = Object.fromEntries(tokenizeSql("SELECT city FROM t WHERE n > 5 AND s = 'x' -- c").map((t) => [t.text, t.kind]));
    expect(kinds).toMatchObject({ SELECT: "keyword", city: "plain", WHERE: "keyword", "5": "number", "'x'": "string", "-- c": "comment" });
  });

  it("treats an unfinished string as a string while typing", () => {
    expect(tokenizeSql("WHERE s = 'ab").at(-1)).toEqual({ kind: "string", text: "'ab" });
  });
});
