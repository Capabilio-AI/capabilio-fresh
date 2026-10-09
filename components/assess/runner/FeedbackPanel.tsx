import { motion } from "framer-motion";
import { Check, Clock, X } from "lucide-react";
import type { Feedback } from "@/lib/assess/types";
import { RichText } from "../ui/CodeText";

/** Result, the ELO change (career questions only), a streak when it is real, and the explanation. */
export function FeedbackPanel({ feedback, isCareer, reduce }: { feedback: Feedback; isCareer: boolean; reduce: boolean }) {
  const ok = feedback.isCorrect;
  return (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      role="status"
      aria-live="polite"
      className={`mt-5 rounded-2xl border p-4 sm:p-5 ${ok ? "border-[var(--ok)]/40 bg-[var(--ok-soft)]/80" : "border-[var(--bad)]/40 bg-[var(--bad-soft)]/80"}`}
    >
      <div className="flex flex-wrap items-center gap-2.5">
        <span className={`inline-flex items-center gap-2 text-[16px] font-bold ${ok ? "text-[var(--ok-ink)]" : "text-[var(--bad-ink)]"}`}>
          <span className={`flex h-6 w-6 items-center justify-center rounded-full text-white ${ok ? "bg-[var(--ok)]" : "bg-[var(--bad)]"}`} aria-hidden>{ok ? <Check className="h-3.5 w-3.5" strokeWidth={3} /> : feedback.timedOut ? <Clock className="h-3.5 w-3.5" strokeWidth={3} /> : <X className="h-3.5 w-3.5" strokeWidth={3} />}</span>
          {ok ? "Correct" : feedback.timedOut ? "Time's up" : "Incorrect"}
        </span>
        {isCareer && feedback.elo && (
          <motion.span
            initial={reduce ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 380, damping: 18, delay: 0.1 }}
            className="rounded-full bg-[var(--m-ink)] px-3 py-1 text-[13px] font-bold text-white"
            aria-label={`ELO ${feedback.elo.change >= 0 ? "plus" : "minus"} ${Math.abs(feedback.elo.change)}, now ${feedback.elo.newRating}`}
          >
            {feedback.elo.change >= 0 ? "+" : "−"}{Math.abs(feedback.elo.change)} ELO <span className="opacity-70">· {feedback.elo.newRating}</span>
          </motion.span>
        )}
      </div>
      {feedback.timedOut && <p className="mt-2 text-[13.5px] font-bold text-[var(--bad-ink)]">No answer was chosen in time, so this counts as incorrect. The right answer is highlighted above.</p>}
      <RichText text={feedback.explanation} className="mt-2.5 text-[14.5px] leading-relaxed text-[var(--m-ink)]/85" />
    </motion.div>
  );
}
