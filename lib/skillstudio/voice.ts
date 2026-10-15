const PREFERRED = /natural|neural|google|samantha|daniel|karen|moira|microsoft (aria|jenny|guy)/i;

export interface VoiceLike {
  name: string;
  lang: string;
  localService: boolean;
}

/**
 * The browser's own voice (free, nothing leaves the device). English first; Indian English preferred because the learners are, then a
 * natural-sounding one when the device has it. Pure, so it can be tested without a browser.
 */
export function pickVoice<T extends VoiceLike>(voices: readonly T[]): T | undefined {
  const en = voices.filter((v) => v.lang.toLowerCase().startsWith("en"));
  const pool = en.some((v) => v.lang.toLowerCase().replace("_", "-") === "en-in") ? en.filter((v) => v.lang.toLowerCase().replace("_", "-") === "en-in") : en;
  return pool.find((v) => PREFERRED.test(v.name)) ?? pool.find((v) => v.localService) ?? pool[0];
}
