"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import Window from "./Window";

const REPLIES: Record<string, string> = {
  "What first?": "SQL is learning and Statistics is not assessed. Finish the joins ticket, then take the Statistics diagnostic.",
  "Why SQL?": "Dashboards stay locked until SQL reaches its target, and your Data Analyst rating moves fastest there.",
  "Am I ready?": "Not yet. Python and EDA meet the target. Statistics has no evidence, so I will not call you ready.",
};

export default function MentorMock() {
  const [asked, setAsked] = useState<string[]>([]);
  return (
    <Window title="Mentor">
      <div className="p-4 sm:p-5">
        <div className="grid min-h-[17rem] content-start gap-2.5 text-sm">
          <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-cap-mist px-4 py-3">
            I know your direction (Data Analyst) and your gaps. Ask me what to do next.
          </div>
          {asked.map((q) => (
            <div key={q} className="grid gap-2.5">
              <div className="ml-auto max-w-[80%] rounded-2xl rounded-br-md bg-cap-indigo px-4 py-3 text-white">{q}</div>
              <div className="max-w-[88%] rounded-2xl rounded-bl-md bg-cap-mist px-4 py-3">{REPLIES[q]}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          {Object.keys(REPLIES).map((q) => (
            <button
              key={q}
              disabled={asked.includes(q)}
              onClick={() => setAsked((a) => [...a, q])}
              className="inline-flex items-center gap-1.5 rounded-full border border-cap-ink/25! px-4 py-2 text-sm font-semibold hover:bg-cap-mist disabled:opacity-40"
            >
              <Send size={13} /> {q}
            </button>
          ))}
        </div>
      </div>
    </Window>
  );
}
