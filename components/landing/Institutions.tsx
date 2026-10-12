import { Check, Minus } from "lucide-react";

function CalendarMini() {
  const rows = [
    { l: "Sem 5", a: 4, b: 38 },
    { l: "Sem 6", a: 46, b: 40 },
    { l: "Sem 7", a: 4, b: 38, ghost: true },
  ];
  return (
    <div className="rounded-2xl border border-cap-line! bg-white p-5" role="img" aria-label="Semester bars set by the college">
      <div className="grid gap-3">
        {rows.map((r) => (
          <div key={r.l} className="flex items-center gap-3 text-sm">
            <span className="w-12 font-medium">{r.l}</span>
            <div className="relative h-7 flex-1 rounded-md bg-cap-mist">
              <div
                className={`absolute inset-y-0 rounded-md ${r.ghost ? "border border-dashed border-cap-ink/40!" : "bg-cap-indigo"}`}
                style={{ left: `${r.a}%`, width: `${r.b}%` }}
              />
            </div>
          </div>
        ))}
      </div>
      <p className="mt-4 text-[13px] text-cap-muted">Set once by the college. Students never type semester dates.</p>
    </div>
  );
}

function RolesMini() {
  const rows: [string, boolean, boolean, boolean][] = [
    ["Student", false, false, true],
    ["Mentor", true, false, false],
    ["Programme lead", true, true, false],
  ];
  return (
    <div className="overflow-hidden rounded-2xl border border-cap-line! bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-cap-mist text-left text-xs text-cap-muted">
            <th className="px-4 py-2.5 font-medium">Role</th>
            <th className="px-2 py-2.5 text-center font-medium">Cohort</th>
            <th className="px-2 py-2.5 text-center font-medium">Calendar</th>
            <th className="px-2 py-2.5 text-center font-medium">Own record</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(([r, ...v]) => (
            <tr key={r} className="border-t border-cap-line!">
              <td className="px-4 py-3 font-medium">{r}</td>
              {v.map((on, i) => (
                <td key={i} className="px-2 py-3 text-center">
                  {on ? <Check size={16} className="mx-auto text-cap-ok" aria-label="allowed" /> : <Minus size={16} className="mx-auto text-cap-muted" aria-label="not allowed" />}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="border-t border-cap-line! px-4 py-3 text-[13px] text-cap-muted">Illustrative roles. A student can always see their own record.</p>
    </div>
  );
}

function ChatMini() {
  return (
    <div className="grid gap-2.5 rounded-2xl border border-cap-line! bg-white p-5 text-sm">
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-cap-mist px-4 py-2.5">The Semester 6 calendar is published.</div>
      <div className="ml-auto max-w-[85%] rounded-2xl rounded-br-md bg-cap-indigo px-4 py-2.5 text-white">Thanks. Cohort B still has no Statistics results.</div>
      <div className="max-w-[85%] rounded-2xl rounded-bl-md bg-cap-mist px-4 py-2.5">I will schedule the diagnostic this week.</div>
    </div>
  );
}

const COLS = [
  { t: "Dates the college owns", b: "Years of study and the academic calendar come from the institution, so every student in a cohort is on the same clock.", Mini: CalendarMini },
  { t: "Access you can reason about", b: "Staff access is governed by roles. Students always see their own record, and only that.", Mini: RolesMini },
  { t: "Talk where the work is", b: "A team chat sits next to access and curriculum, so a decision and the data behind it stay together.", Mini: ChatMini },
];

export default function Institutions() {
  return (
    <section id="institutions" className="bg-cap-paper px-5 py-20 md:px-10 md:py-24">
      <div className="mx-auto max-w-[84rem]">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <h2 data-rise className="max-w-3xl font-cap-display text-[clamp(2.2rem,5vw,4rem)] font-semibold leading-[1.04] tracking-[-0.03em]" style={{ textWrap: "balance" }}>
            Built for colleges, universities and companies.
          </h2>
        </div>
        <div className="mt-14 grid gap-12 lg:grid-cols-3 lg:gap-10">
          {COLS.map(({ t, b, Mini }) => (
            <div key={t} data-rise className="flex flex-col">
              <div className="lg:min-h-[17rem]">
                <Mini />
              </div>
              <h3 className="mt-7 font-cap-display text-2xl font-semibold tracking-tight">{t}</h3>
              <p className="mt-2 text-base leading-relaxed text-cap-muted">{b}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
