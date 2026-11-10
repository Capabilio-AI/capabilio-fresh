import type { BankRow } from "./draft";
import { aptitudeBank } from "./aptitude";
import { reasoningBank } from "./reasoning";
import { softSkillsBank } from "./soft-skills";
import { verbalBank } from "./verbal";

/** The whole CRT question bank, built the same way every time. */
export const buildBank = (): BankRow[] => [...aptitudeBank(), ...reasoningBank(), ...verbalBank(), ...softSkillsBank()];
