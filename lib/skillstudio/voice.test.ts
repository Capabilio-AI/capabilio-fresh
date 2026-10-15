import { describe, expect, it } from "vitest";
import { pickVoice } from "./voice";

const v = (name: string, lang: string, localService = true) => ({ name, lang, localService });

describe("pickVoice", () => {
  it("prefers Indian English, then a natural-sounding voice", () => {
    const voices = [v("Alex", "en-US"), v("Google US English", "en-US"), v("Veena", "en-IN"), v("Google UK English", "en-GB")];
    expect(pickVoice(voices)?.name).toBe("Veena");
    expect(pickVoice(voices.filter((x) => x.lang !== "en-IN"))?.name).toBe("Google US English");
  });
  it("ignores other languages and returns nothing when there is no English voice", () => {
    expect(pickVoice([v("Amelie", "fr-FR")])).toBeUndefined();
    expect(pickVoice([])).toBeUndefined();
  });
});
