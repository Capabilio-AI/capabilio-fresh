import type { AssessmentResult, Feedback, QuestionPayload, SessionStart, SessionState } from "@/lib/assess/types";
import type { ResolveOutcome } from "@/lib/assess/roles";
import type { StoredFeedback } from "@/lib/assess/feedback";

export class ApiError extends Error {
  constructor(message: string, readonly code: string, readonly status: number, readonly retryable: boolean) {
    super(message);
  }
}
/** The request never reached the server (offline, dropped connection). Safe to retry: answers are idempotent per question. */
export class NetworkError extends Error {}

async function call<T>(url: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  } catch {
    throw new NetworkError("Network unavailable");
  }
  const body = (await res.json().catch(() => ({}))) as { error?: string; code?: string; retryable?: boolean } & T;
  if (!res.ok) throw new ApiError(body.error ?? "Something went wrong.", body.code ?? "ERROR", res.status, body.retryable ?? res.status >= 500);
  return body;
}

export const assessApi = {
  start: (layer: "GENERAL" | "CAREER", careerId?: string) => call<SessionStart & { state: SessionState }>("/api/assess/start", { method: "POST", body: JSON.stringify({ layer, careerId }) }),
  state: (sessionId: string) => call<SessionState>(`/api/assess/session/${sessionId}`),
  next: (sessionId: string) => call<{ question: QuestionPayload | null; ended: boolean }>(`/api/assess/session/${sessionId}/next`, { method: "POST" }),
  answer: (input: { sessionQuestionId: string; attemptId: string; optionIndex: number; responseMs?: number }) =>
    call<Feedback & { sessionId: string }>("/api/assess/answer", { method: "POST", body: JSON.stringify(input) }),
  resolveRole: (text: string) => call<ResolveOutcome>("/api/assess/role/resolve", { method: "POST", body: JSON.stringify({ text }) }),
  confirmRole: (careerId: string) => call<{ ok: true }>("/api/assess/role/confirm", { method: "POST", body: JSON.stringify({ careerId }) }),
  feedback: (sessionId: string) => call<{ status: "PENDING" | "READY"; feedback: StoredFeedback[] }>(`/api/assess/session/${sessionId}/feedback`),
  event: (name: "assessment_popup_viewed" | "dashboard_opened_after_assessment") => fetch("/api/assess/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => {}),
  submit: (sessionId: string) => call<{ result: AssessmentResult }>(`/api/assess/session/${sessionId}/submit`, { method: "POST" }),
};

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
