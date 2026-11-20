import type { AssessmentResult, Feedback, QuestionPayload, SessionStart, SessionState } from "@/lib/assess/types";
import type { ResolveChoice, ResolveOutcome } from "@/lib/assess/roles";
import type { StoredFeedback } from "@/lib/assess/feedback";
import type { ResumeSummary } from "@/lib/graduate/summary";

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

async function callForm<T>(url: string, body?: FormData): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { method: "POST", body });
  } catch {
    throw new NetworkError("Network unavailable");
  }
  const json = (await res.json().catch(() => ({}))) as { error?: string; code?: string; retryable?: boolean } & T;
  if (!res.ok) throw new ApiError(json.error ?? "Something went wrong.", json.code ?? "ERROR", res.status, json.retryable ?? res.status >= 500);
  return json;
}

export const assessApi = {
  uploadResume: (file: File) => {
    const form = new FormData();
    form.set("resume", file);
    return callForm<{ summary: ResumeSummary }>("/api/graduate/resume", form);
  },
  skipResume: () => callForm<{ summary: ResumeSummary }>("/api/graduate/resume?skip=1"),
  start: (layer: "GENERAL" | "CAREER", careerId?: string) => startWithRetry(layer, careerId),
  state: (sessionId: string) => call<SessionState>(`/api/assess/session/${sessionId}`),
  next: (sessionId: string) => call<{ question: QuestionPayload | null; ended: boolean }>(`/api/assess/session/${sessionId}/next`, { method: "POST" }),
  answer: (input: { sessionQuestionId: string; attemptId: string; optionIndex: number; responseMs?: number }) =>
    call<Feedback & { sessionId: string }>("/api/assess/answer", { method: "POST", body: JSON.stringify(input) }),
  resolveRole: (text: string, choice?: ResolveChoice) => call<ResolveOutcome>("/api/assess/role/resolve", { method: "POST", body: JSON.stringify({ text, choice }) }),
  startRoleSwitch: (careerId: string, typed?: string) => call<{ ok: true }>("/api/career-intent/plan-b/switch", { method: "POST", body: JSON.stringify({ careerId, typed }) }),
  confirmRole: (careerId: string, typed?: string, explore?: boolean) => call<{ ok: true }>("/api/assess/role/confirm", { method: "POST", body: JSON.stringify({ careerId, typed, explore }) }),
  /** 1st and 2nd years only: take the common assessment without choosing a role */
  skipRole: () => call<{ ok: true }>("/api/assess/role/skip", { method: "POST" }),
  feedback: (sessionId: string) => call<{ status: "PENDING" | "READY"; feedback: StoredFeedback[] }>(`/api/assess/session/${sessionId}/feedback`),
  event: (name: "assessment_popup_viewed" | "dashboard_opened_after_assessment") => fetch("/api/assess/event", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }).catch(() => {}),
  submit: (sessionId: string) => call<{ result: AssessmentResult }>(`/api/assess/session/${sessionId}/submit`, { method: "POST" }),
  /** ends the test now: only what is answered counts */
  end: (sessionId: string, reason: "student" | "integrity") => call<{ result: AssessmentResult }>(`/api/assess/session/${sessionId}/end`, { method: "POST", body: JSON.stringify({ reason }) }),
};

const START_ATTEMPT_MS = 25_000;
const START_ATTEMPTS = 3;

/** A cold question pool can make the server take over a minute and get killed. Starting is idempotent (it resumes the open session), so give up on a slow attempt and ask again. */
async function startWithRetry(layer: "GENERAL" | "CAREER", careerId?: string): Promise<SessionStart & { state: SessionState }> {
  for (let attempt = 1; ; attempt++) {
    try {
      return await call<SessionStart & { state: SessionState }>("/api/assess/start", { method: "POST", body: JSON.stringify({ layer, careerId }), signal: AbortSignal.timeout(START_ATTEMPT_MS) });
    } catch (e) {
      if (attempt >= START_ATTEMPTS || !(e instanceof NetworkError)) throw e;
    }
  }
}

export const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
