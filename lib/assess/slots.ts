// What a block of questions is about. A CareerSlot is one skill of one role; a GeneralSlot is one section of the common assessment.
export interface CareerSlot {
  kind: "CAREER";
  careerId: string;
  careerKey: string;
  careerName: string;
  skillId: string;
  skillKey: string;
  skillName: string;
  skillDescription: string | null;
  category: string | null;
}
export interface GeneralSlot {
  kind: "GENERAL";
  section: string;
  label: string;
  skills: string[];
  guidance: string;
}
export type Slot = CareerSlot | GeneralSlot;
