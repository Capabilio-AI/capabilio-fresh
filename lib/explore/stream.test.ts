import { describe, expect, it } from "vitest";
import { streamOf } from "./stream";

describe("streamOf", () => {
  it("reads common branch spellings", () => {
    expect(streamOf("Computer Science and Engineering (CSE)")).toBe("it");
    expect(streamOf("Electronics and Communication Engineering (ECE)")).toBe("ece");
    expect(streamOf("Electrical and Electronics Engineering (EEE)")).toBe("eee");
    expect(streamOf("Mechanical Engineering")).toBe("mech");
    expect(streamOf("Civil Engineering")).toBe("civil");
  });
  it("falls back to other", () => {
    expect(streamOf(null)).toBe("other");
    expect(streamOf("MBA")).toBe("other");
  });
});
