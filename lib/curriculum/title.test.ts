import { describe, expect, it } from "vitest";
import { tidyTitle } from "./title";

describe("tidyTitle", () => {
  it("title-cases a name typed in capitals", () => {
    expect(tidyTitle("BLOCK CHAIN TECHNOLOGY")).toBe("Block Chain Technology");
    expect(tidyTitle("CONSTITUTION OF INDIA")).toBe("Constitution of India");
  });
  it("keeps short acronyms and roman numerals", () => {
    expect(tidyTitle("EXPLAINABLE AI")).toBe("Explainable AI");
    expect(tidyTitle("PROGRAMMING II")).toBe("Programming II");
  });
  it("leaves mixed-case names alone", () => {
    expect(tidyTitle("DevOps")).toBe("DevOps");
    expect(tidyTitle("Linear Algebra & Calculus")).toBe("Linear Algebra & Calculus");
  });
});

describe("tidyTitle spacing", () => {
  it("adds the missing space before an ampersand", () => expect(tidyTitle("Digital Logic& Computer Organization")).toBe("Digital Logic & Computer Organization"));
  it("leaves R&D alone", () => expect(tidyTitle("R&D Methods")).toBe("R&D Methods"));
});
