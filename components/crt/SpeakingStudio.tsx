"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, Square, X } from "lucide-react";
import { SPEAKING_DIMENSIONS, SPEAKING_PROMPTS, SPEAKING_TRACKS, type SpeakingFeedback, type SpeakingTrack } from "@/lib/crt/speaking";
import { crtPost, formatClock } from "./api";

interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((e: { resultIndex: number; results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}
type RecognitionCtor = new () => Recognition;

const recognitionCtor = (): RecognitionCtor | null => {
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
};

interface Result {
  feedback: SpeakingFeedback;
  pct: number;
  previousPct: number | null;
}

export function SpeakingStudio({ recent, onClose }: { recent: { at: string; pct: number }[]; onClose: () => void }) {
  const [track, setTrack] = useState<SpeakingTrack>("self_intro");
  const prompts = SPEAKING_PROMPTS.filter((p) => p.track === track);
  const [promptKey, setPromptKey] = useState(prompts[0].key);
  const prompt = SPEAKING_PROMPTS.find((p) => p.key === promptKey) ?? prompts[0];
  const [text, setText] = useState("");
  const [recording, setRecording] = useState(false);
  const [seconds, setSeconds] = useState(0);
  // only ever rendered after a click, so the browser is known here
  const [supported] = useState(() => typeof window !== "undefined" && recognitionCtor() !== null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const rec = useRef<Recognition | null>(null);
  const base = useRef("");

  useEffect(() => {
    return () => rec.current?.stop();
  }, []);

  useEffect(() => {
    if (!recording) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [recording]);

  function pickTrack(t: SpeakingTrack) {
    stop();
    setTrack(t);
    setPromptKey(SPEAKING_PROMPTS.find((p) => p.track === t)!.key);
    setResult(null);
    setText("");
    setSeconds(0);
  }

  function start() {
    const Ctor = recognitionCtor();
    if (!Ctor) return;
    setError(null);
    base.current = text ? `${text.trim()} ` : "";
    const r = new Ctor();
    r.lang = "en-IN";
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let spoken = "";
      for (let i = 0; i < e.results.length; i++) spoken += e.results[i][0].transcript;
      setText(base.current + spoken);
    };
    r.onerror = (e) => {
      if (e.error !== "no-speech" && e.error !== "aborted") setError(e.error === "not-allowed" ? "Microphone access was blocked. Allow it in your browser, or type your answer instead." : "Voice capture stopped. You can keep going by typing.");
      setRecording(false);
    };
    r.onend = () => setRecording(false);
    rec.current = r;
    r.start();
    setRecording(true);
  }

  function stop() {
    rec.current?.stop();
    setRecording(false);
  }

  async function submit() {
    stop();
    setBusy(true);
    setError(null);
    try {
      setResult(await crtPost<Result>({ action: "speak", promptKey: prompt.key, transcript: text, seconds: seconds > 0 ? Math.min(seconds, 900) : undefined }));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not get feedback just now.");
    } finally {
      setBusy(false);
    }
  }

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[var(--m-ground)]" role="dialog" aria-modal="true" aria-label="Speaking Studio">
      <div className="mx-auto flex min-h-full max-w-3xl flex-col gap-5 px-4 py-6 sm:px-6">
        <header className="flex items-start justify-between gap-3">
          <div>
            <p className="font-lp-body text-[12px] font-bold uppercase tracking-wide text-app-muted">English speaking</p>
            <h2 className="font-lp-display text-[28px] font-bold text-app-charcoal">Speaking Studio</h2>
            <p className="mt-1 max-w-[56ch] font-lp-body text-[13.5px] text-app-muted">Answer aloud or in writing and get feedback on grammar, vocabulary, clarity, flow, sentence structure and relevance. Your accent is never marked. Your voice stays in your browser; only the text of your answer is sent for feedback.</p>
          </div>
          <button type="button" onClick={() => { stop(); onClose(); }} aria-label="Close Speaking Studio" className="shrink-0 rounded-lg p-2 text-app-muted hover:bg-[var(--m-accent-soft)]"><X size={20} /></button>
        </header>

        <div role="tablist" aria-label="Practice tracks" className="flex gap-1 overflow-x-auto">
          {SPEAKING_TRACKS.map((t) => (
            <button key={t.key} role="tab" type="button" aria-selected={track === t.key} onClick={() => pickTrack(t.key)} className={`shrink-0 rounded-full border px-3.5 py-1.5 font-lp-body text-[13px] font-semibold ${track === t.key ? "border-[var(--m-ink)] bg-[var(--m-ink)] text-white" : "border-app-border bg-white text-app-charcoal hover:bg-[var(--m-accent-soft)]"}`}>{t.label}</button>
          ))}
        </div>

        <section className="rounded-2xl border border-app-border bg-white p-5">
          <label htmlFor="prompt-pick" className="font-lp-body text-[12px] font-bold uppercase tracking-wide text-app-muted">Prompt</label>
          <select id="prompt-pick" value={promptKey} onChange={(e) => { setPromptKey(e.target.value); setResult(null); setText(""); setSeconds(0); }} className="mt-1.5 w-full rounded-lg border border-app-border bg-white px-3 py-2 font-lp-body text-[14px] text-app-charcoal">
            {prompts.map((p, i) => <option key={p.key} value={p.key}>{i + 1}. {p.text}</option>)}
          </select>
          <p className="mt-4 font-lp-display text-[20px] font-semibold leading-snug text-app-charcoal">{prompt.text}</p>
          <p className="mt-1 font-lp-body text-[13px] text-app-muted">Hint: {prompt.hint} Aim for about {prompt.seconds} seconds.</p>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            {supported ? (
              recording ? (
                <button type="button" onClick={stop} className="inline-flex items-center gap-2 rounded-xl bg-app-warning px-4 py-2.5 font-lp-body text-[13.5px] font-semibold text-white"><Square size={14} aria-hidden /> Stop · {formatClock(seconds)}</button>
              ) : (
                <button type="button" onClick={start} className="inline-flex items-center gap-2 rounded-xl bg-[var(--m-ink)] px-4 py-2.5 font-lp-body text-[13.5px] font-semibold text-white"><Mic size={14} aria-hidden /> {text ? "Keep recording" : "Start recording"}</button>
              )
            ) : (
              <p className="font-lp-body text-[13px] text-app-muted">Voice capture is not available in this browser. Type your answer below, or open Capabilio in Chrome or Edge to speak it.</p>
            )}
            {recording && <span className="flex items-center gap-1.5 font-lp-body text-[12.5px] text-app-muted" role="status"><span aria-hidden className="h-2 w-2 animate-pulse rounded-full bg-app-warning motion-reduce:animate-none" /> Listening…</span>}
          </div>

          <label htmlFor="answer" className="mt-4 block font-lp-body text-[12px] font-bold uppercase tracking-wide text-app-muted">Your answer <span className="font-medium normal-case tracking-normal">(fix any word the microphone misheard before you submit)</span></label>
          <textarea id="answer" value={text} onChange={(e) => setText(e.target.value)} rows={6} maxLength={4000} className="mt-1.5 w-full resize-y rounded-lg border border-app-border bg-white px-3 py-2.5 font-lp-body text-[14.5px] leading-relaxed text-app-charcoal" placeholder="Speak, or type your answer here…" />
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <span className="font-lp-body text-[12.5px] text-app-muted">{words} word{words === 1 ? "" : "s"}</span>
            <button type="button" onClick={() => void submit()} disabled={busy || words < 8} className="inline-flex items-center gap-2 rounded-xl bg-[var(--m-ink)] px-5 py-2.5 font-lp-body text-[13.5px] font-semibold text-white disabled:opacity-50">{busy && <Loader2 size={14} className="animate-spin" aria-hidden />}Get feedback</button>
          </div>
          {error && <p role="alert" className="mt-3 font-lp-body text-[13px] text-app-warning">{error}</p>}
        </section>

        {result && <FeedbackCard result={result} />}

        {recent.length > 0 && (
          <section className="rounded-2xl border border-app-border bg-white p-5" aria-label="Your recent attempts">
            <h3 className="font-lp-body text-[13px] font-bold text-app-charcoal">Your recent attempts</h3>
            <ol className="mt-3 flex items-end gap-2" aria-label="Overall score of each attempt">
              {recent.map((r, i) => (
                <li key={`${r.at}-${i}`} className="flex flex-1 flex-col items-center gap-1" title={new Date(r.at).toLocaleDateString("en-IN")}>
                  <span className="font-lp-body text-[11.5px] tabular-nums text-app-muted">{r.pct}%</span>
                  <span className="w-full rounded-t-md bg-[var(--m-accent)]" style={{ height: `${Math.max(6, r.pct * 0.6)}px` }} />
                </li>
              ))}
            </ol>
          </section>
        )}
      </div>
    </div>
  );
}

function FeedbackCard({ result }: { result: Result }) {
  const { feedback, pct, previousPct } = result;
  const delta = previousPct === null ? null : pct - previousPct;
  return (
    <section className="rounded-2xl border border-app-border bg-white p-5" aria-label="Feedback" aria-live="polite">
      <div className="flex flex-wrap items-end gap-3">
        <span className="font-lp-display text-[44px] font-bold leading-none tabular-nums text-app-charcoal">{pct}%</span>
        <span className="mb-1 font-lp-body text-[13.5px] text-app-muted">overall{delta !== null && delta !== 0 ? ` · ${delta > 0 ? "up" : "down"} ${Math.abs(delta)} from your last try at this prompt` : delta === 0 ? " · same as your last try at this prompt" : ""}</span>
      </div>
      <ul className="mt-4 grid gap-3 sm:grid-cols-2">
        {SPEAKING_DIMENSIONS.map((d) => {
          const v = feedback.scores[d.key];
          return (
            <li key={d.key}>
              <div className="mb-1 flex justify-between font-lp-body text-[13px]"><span className="font-semibold text-app-charcoal">{d.label}</span><span className="tabular-nums text-app-muted">{v.toFixed(1)}/10</span></div>
              <div role="meter" aria-label={d.label} aria-valuemin={0} aria-valuemax={10} aria-valuenow={v} className="h-2 overflow-hidden rounded-full bg-[var(--m-accent-soft)]"><div className={`h-full rounded-full ${v >= 6 ? "bg-app-success" : "bg-app-warning"}`} style={{ width: `${v * 10}%` }} /></div>
            </li>
          );
        })}
      </ul>
      <div className="mt-5 grid gap-4 sm:grid-cols-2">
        <div><h4 className="font-lp-body text-[12px] font-bold uppercase tracking-wide text-app-success">What worked</h4><ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 font-lp-body text-[13.5px] leading-relaxed text-app-charcoal">{feedback.strengths.map((s) => <li key={s}>{s}</li>)}</ul></div>
        <div><h4 className="font-lp-body text-[12px] font-bold uppercase tracking-wide text-app-warning">To improve</h4><ul className="mt-2 flex list-disc flex-col gap-1.5 pl-4 font-lp-body text-[13.5px] leading-relaxed text-app-charcoal">{feedback.improvements.map((s) => <li key={s}>{s}</li>)}</ul></div>
      </div>
      <div className="mt-5 rounded-xl bg-[var(--m-accent-soft)] p-4">
        <h4 className="font-lp-body text-[12px] font-bold uppercase tracking-wide text-[var(--m-muted)]">A stronger version, in your own ideas</h4>
        <p className="mt-1.5 font-lp-body text-[14.5px] leading-relaxed text-[var(--m-ink)]">{feedback.betterVersion}</p>
      </div>
      <p className="mt-3 font-lp-body text-[12px] text-app-muted">Flow is judged from the words of your answer (order of ideas, fillers). Pace and pronunciation are not scored.</p>
    </section>
  );
}
