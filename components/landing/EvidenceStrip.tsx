import { Award, ClipboardCheck, FileCheck2, FolderGit2, GitBranch, GraduationCap, MapPinned, Swords } from "lucide-react";
import { StateGlyph, type NodeState } from "./StateGlyph";

const ITEMS = [
  { icon: GraduationCap, label: "Academic record" },
  { icon: ClipboardCheck, label: "Assessments" },
  { icon: Swords, label: "Arena tickets" },
  { icon: GitBranch, label: "GitHub activity" },
  { icon: FolderGit2, label: "Projects" },
  { icon: Award, label: "Certificates" },
  { icon: MapPinned, label: "Career map" },
  { icon: FileCheck2, label: "Skill Passport" },
];

const SKILLS: { label: string; state: NodeState }[] = [
  { label: "Python", state: "met" },
  { label: "SQL", state: "learning" },
  { label: "Statistics", state: "none" },
  { label: "Git & review", state: "check" },
  { label: "Dashboards", state: "locked" },
  { label: "Exploratory analysis", state: "met" },
  { label: "Testing", state: "none" },
  { label: "System design", state: "locked" },
];

export default function EvidenceStrip() {
  return (
    <section id="evidence" className="border-b border-cap-line! bg-cap-paper py-10" aria-label="What Capabilio reads">
      <p data-rise className="mx-auto max-w-[84rem] px-5 font-cap-display text-xl text-cap-ink md:px-10 md:text-2xl">
        Every level on the map traces back to something that was measured.
      </p>
      <div className="cap-marquee-wrap cap-fade-x mt-7 overflow-hidden" aria-hidden="true">
        <div className="cap-marquee gap-4 pr-4">
          {[...ITEMS, ...ITEMS].map(({ icon: Icon, label }, i) => (
            <span key={i} className="flex items-center gap-3 rounded-full border border-cap-line! bg-white px-6 py-3.5 text-base font-medium text-cap-ink">
              <Icon size={20} strokeWidth={1.75} className="text-cap-indigo" />
              {label}
            </span>
          ))}
        </div>
      </div>
      <div className="cap-marquee-wrap cap-fade-x mt-4 overflow-hidden" aria-hidden="true">
        <div className="cap-marquee cap-marquee-rev gap-4 pr-4">
          {[...SKILLS, ...SKILLS].map(({ label, state }, i) => (
            <span key={i} className="flex items-center gap-3 rounded-full bg-cap-ink px-6 py-3.5 text-base font-medium text-cap-paper">
              <StateGlyph state={state} size={18} ink="#fcfcfb" fill="#0c1020" />
              {label}
            </span>
          ))}
        </div>
      </div>
      <ul className="sr-only">
        {ITEMS.map((i) => (
          <li key={i.label}>{i.label}</li>
        ))}
      </ul>
    </section>
  );
}
