import { Check, Minus } from "lucide-react";
import Window from "./Window";

const SIGNALS = [
  { label: "Tests", on: true },
  { label: "CI workflow", on: true },
  { label: "README", on: true },
  { label: "License", on: false },
];
const STACK = ["Python", "SQL", "Docker", "Jupyter"];
const PRS = [3, 5, 2, 6, 4, 7, 3, 8, 5, 6, 9, 7];

export default function CodeDnaMock() {
  const max = Math.max(...PRS);
  return (
    <Window title="Code DNA · sales-dashboard">
      <div className="grid gap-4 p-4 sm:p-5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold">Stack from the files present</span>
          {STACK.map((s) => (
            <span key={s} className="rounded-full bg-cap-indigo-soft px-3 py-1 text-xs font-semibold text-cap-indigo">
              {s}
            </span>
          ))}
        </div>

        <ul className="grid grid-cols-2 gap-2">
          {SIGNALS.map((s) => (
            <li key={s.label} className="flex items-center gap-2.5 rounded-lg border border-cap-line! px-3 py-2.5 text-sm">
              <span className={`grid h-5 w-5 place-items-center rounded-full ${s.on ? "bg-cap-ok text-white" : "bg-cap-mist text-cap-muted"}`}>
                {s.on ? <Check size={13} strokeWidth={3} /> : <Minus size={13} />}
              </span>
              {s.label}
              <span className="ml-auto text-xs text-cap-muted">{s.on ? "found" : "not found"}</span>
            </li>
          ))}
        </ul>

        <div>
          <div className="mb-1.5 flex justify-between text-sm">
            <span className="font-semibold">Authored vs forked</span>
            <span className="text-cap-muted">7 of 9 repositories</span>
          </div>
          <div className="flex h-3 overflow-hidden rounded-full bg-cap-mist">
            <div className="w-[78%] bg-cap-indigo" />
            <div className="w-[22%] bg-cap-apricot" />
          </div>
        </div>

        <div>
          <div className="mb-2 text-sm font-semibold">Pull requests per week</div>
          <div className="flex h-16 items-end gap-1.5" role="img" aria-label="Pull requests per week, rising over twelve weeks">
            {PRS.map((n, i) => (
              <div key={i} className="flex-1 rounded-t bg-cap-ink" style={{ height: `${(n / max) * 100}%`, opacity: 0.35 + (i / PRS.length) * 0.65 }} />
            ))}
          </div>
        </div>

        <p className="rounded-xl bg-cap-mist p-3.5 text-[13px] leading-relaxed text-cap-ink/80">
          <strong className="font-semibold text-cap-ink">Limits.</strong> Reads public repositories only and reports what is in them.
          It does not claim to detect copied code.
        </p>
      </div>
    </Window>
  );
}
