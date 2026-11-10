import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { CrtDue } from "@/lib/crt/server";
import { formatWhen } from "./api";

/** On the Dashboard while a CRT cycle is open and the student has not finished it. Goes straight into the assessment. */
export function CrtDueCard({ due }: { due: CrtDue }) {
  const soon = due.closesSoon;
  return (
    <div className="mb-2 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-app-border bg-white p-4">
      <div className="max-w-[62ch]">
        <p className="font-lp-body text-[13.5px] font-semibold text-app-charcoal">{due.inProgress ? "Finish your CRT assessment" : `${due.title} is open`}</p>
        <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">
          {due.inProgress ? "You started it. Your answers are saved." : "Aptitude, reasoning, communication and soft skills. Your placement cell sees the score."}{" "}
          <span className={soon ? "font-semibold text-app-warning" : undefined}>Closes {formatWhen(due.closesAt)}.</span>
        </p>
      </div>
      <Link href={`/skillstudio/crt?take=${due.cycleId}`} className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--m-ink)] px-4 py-2 font-lp-body text-[13px] font-semibold text-white">
        {due.inProgress ? "Resume" : "Start"} <ArrowRight size={14} aria-hidden />
      </Link>
    </div>
  );
}
