"use client";

import { asRecord, checksOf, text, type RuntimeProps } from "./types";

/** Scenario questions: each CHOICE_ANSWER check publishes its prompt and options (config.public); the correct answer never reaches the browser. */
export function QuestionFlow({ view, draft, onDraft, disabled }: RuntimeProps) {
  const answers = asRecord<string | string[]>(draft.answers);
  const questions = checksOf(view, "CHOICE_ANSWER");
  const set = (id: string, value: string | string[]) => onDraft({ ...draft, answers: { ...answers, [id]: value } });

  if (questions.length === 0) return <p className="font-lp-body text-[13px] text-app-muted">This challenge has no questions yet.</p>;

  return (
    <ol className="flex flex-col gap-6">
      {questions.map((q, i) => {
        const options = Array.isArray(q.public?.options) ? (q.public.options as string[]) : [];
        const multiple = q.public?.multiple === true;
        const current = answers[q.id];
        const selected = Array.isArray(current) ? current : current ? [current] : [];
        return (
          <li key={q.id}>
            <fieldset disabled={disabled}>
              <legend className="font-lp-body text-[14px] font-semibold text-app-charcoal">
                {i + 1}. {text(q.public?.prompt) || q.label}
              </legend>
              {multiple && <p className="mt-0.5 font-lp-body text-[12px] text-app-muted">Select all that apply.</p>}
              <div className="mt-2 flex flex-col gap-2">
                {options.map((option) => {
                  const checked = selected.includes(option);
                  return (
                    <label key={option} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3.5 py-2.5 font-lp-body text-[13.5px] ${checked ? "border-app-blue bg-app-blue-container" : "border-app-border bg-white"}`}>
                      <input
                        type={multiple ? "checkbox" : "radio"}
                        name={q.id}
                        checked={checked}
                        onChange={() => set(q.id, multiple ? (checked ? selected.filter((s) => s !== option) : [...selected, option]) : option)}
                        className="mt-1"
                      />
                      <span>{option}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>
          </li>
        );
      })}
    </ol>
  );
}
