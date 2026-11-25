/** A hand-written, runner-verified lesson of a role's learning path. Every example's `output` was recorded from a real run, never typed. */
export interface RoleLesson {
  key: string;
  title: string;
  minutes: number;
  summary: string;
  analogy: { icon: string; title: string; text: string; pairs: [string, string][] };
  sections: { heading: string; body: string[]; example: { title: string; code: string; explanation: string; output: string } }[];
  check: { question: string; options: string[]; answerIndex: number; why: string }[];
}
