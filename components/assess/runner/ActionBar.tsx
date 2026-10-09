import { ArrowRight, Send } from "lucide-react";
import type { Feedback } from "@/lib/assess/types";
import { Button } from "../ui/Button";

export type Phase = "answering" | "saving" | "feedback" | "loading-next" | "submitting" | "retry";

/** Next on every question but the last; Submit only on the last one, and only once its answer and feedback are in. */
export function ActionBar({ phase, feedback, onNext, onSubmit }: { phase: Phase; feedback: Feedback | null; onNext: () => void; onSubmit: () => void }) {
  if (phase !== "feedback" || !feedback) return null;
  return feedback.isLast ? (
    <Button variant="accent" size="lg" onClick={onSubmit} icon={<Send className="h-4.5 w-4.5" aria-hidden />} hint="Enter">Submit</Button>
  ) : (
    <Button variant="primary" size="lg" onClick={onNext} iconAfter={<ArrowRight className="h-5 w-5" aria-hidden />} hint="Enter">Next</Button>
  );
}
