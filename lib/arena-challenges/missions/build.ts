import { hashSeed, makeRng } from "@/lib/workplace/rng";
import { validateScenario } from "./grid";
import { labsFor } from "./registry";
import { MISSION_MINUTES } from "./score";
import { realStoryDeps, writeStory, type StoryDeps } from "./story";
import type { AnyLab, Difficulty, Family } from "./types";

const SCENARIO_TRIES = 24;
const LABS_TRIED = 3;

export interface MissionAsk {
  family: Family;
  difficulty: Difficulty;
  /** a course from the student's curriculum, matched against each lab's keywords */
  subject: string | null;
  /** how many missions of each lab the student already has: the least-used lab goes first */
  usage: ReadonlyMap<string, number>;
  avoidTitles: readonly string[];
  seed: number;
}

export interface MissionDraft {
  labKey: string;
  scenario: unknown;
  title: string;
  story: string;
  mission: string;
  category: string;
  difficulty: Difficulty;
  skillTags: string[];
  minutes: number;
  /** how many of the lab's settings win, out of how many were checked */
  winning: { passing: number; total: number };
  aiStory: boolean;
}

/** Pure. The labs to try, best fit first: those matching the course title, then the least-used. */
export function orderLabs(labs: AnyLab[], subject: string | null, usage: ReadonlyMap<string, number>, seed: number): AnyLab[] {
  const rng = makeRng(seed);
  const text = (subject ?? "").toLowerCase();
  const fit = (l: AnyLab) => (text && l.keywords.some((k) => text.includes(k)) ? 0 : 1);
  return rng.shuffle(labs).sort((a, b) => fit(a) - fit(b) || (usage.get(a.key) ?? 0) - (usage.get(b.key) ?? 0));
}

/** A mission that has proved itself: some settings win, the starting ones do not, and most do not. Null when no lab of the family could be built. */
export async function buildMission(ask: MissionAsk, storyDeps: StoryDeps = realStoryDeps): Promise<MissionDraft | null> {
  for (const lab of orderLabs(labsFor(ask.family), ask.subject, ask.usage, ask.seed).slice(0, LABS_TRIED)) {
    for (let attempt = 0; attempt < SCENARIO_TRIES; attempt++) {
      const scenario = lab.makeScenario(makeRng(hashSeed(ask.seed, lab.key, attempt)), ask.difficulty);
      const v = validateScenario(lab, scenario, ask.difficulty);
      if (!v.ok) continue;
      const story = await writeStory(lab, scenario, ask.difficulty, ask.avoidTitles, storyDeps);
      return { labKey: lab.key, scenario, title: story.title, story: story.story, mission: lab.mission(scenario), category: lab.topic, difficulty: ask.difficulty, skillTags: lab.skillTags, minutes: MISSION_MINUTES[ask.difficulty], winning: { passing: v.passing, total: v.total }, aiStory: story.ai };
    }
  }
  return null;
}
