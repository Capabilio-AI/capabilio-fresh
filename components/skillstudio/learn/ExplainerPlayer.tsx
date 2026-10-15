"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Captions, Pause, Play, RotateCcw, Volume2, VolumeX } from "lucide-react";
import clsx from "clsx";
import { EXPLAINER_FPS, EXPLAINER_H, EXPLAINER_W, planExplainer, sceneAt, type VideoScript } from "@/lib/skillstudio/lesson-content";
import { pickVoice } from "@/lib/skillstudio/voice";
import { Explainer } from "./ExplainerScenes";

const SPEEDS = [1, 1.25, 1.5] as const;
const BASE_RATE = 0.98;
const noopSubscribe = () => () => {};
const canSpeak = () => "speechSynthesis" in window;

/**
 * Plays a script as a narrated explainer. The voice is the clock: each scene waits at its end until the narrator has finished the line,
 * so words are never cut off, and a slow voice just takes a little longer. Without a voice it runs on the estimated timeline with captions.
 */
export default function ExplainerPlayer({ script }: { script: VideoScript }) {
  const ref = useRef<PlayerRef>(null);
  const plan = useMemo(() => planExplainer(script), [script]);
  const speechSupported = useSyncExternalStore(noopSubscribe, canSpeak, () => false);
  const [voice, setVoice] = useState(true);
  const [captions, setCaptions] = useState(true);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);
  const [playing, setPlaying] = useState(false);
  const [ended, setEnded] = useState(false);
  const [scene, setScene] = useState(0);

  const spoken = useRef(-1); // the scene whose line has been started
  const talking = useRef(false); // a line is being spoken now
  const holding = useRef(false); // the picture is waiting at a scene's end for the line to finish
  const live = useRef({ voice, speed });
  useEffect(() => { live.current = { voice, speed }; }, [voice, speed]);

  const silence = useCallback(() => {
    if (!canSpeak()) return;
    window.speechSynthesis.cancel();
    talking.current = false;
  }, []);

  const goTo = useCallback((i: number, play = true) => {
    const p = ref.current;
    if (!p) return;
    silence();
    holding.current = false;
    spoken.current = -1;
    setEnded(false);
    p.seekTo(plan.scenes[i].start);
    setScene(i);
    if (play) p.play();
  }, [plan, silence]);

  const speak = useCallback((i: number) => {
    if (!canSpeak() || !live.current.voice) return;
    silence();
    const u = new SpeechSynthesisUtterance(script.scenes[i].say);
    const v = pickVoice(window.speechSynthesis.getVoices());
    u.voice = v ?? null;
    u.lang = v?.lang ?? "en-US";
    u.rate = BASE_RATE * live.current.speed;
    talking.current = true;
    u.onend = () => {
      talking.current = false;
      const p = ref.current;
      if (!holding.current || !p) return;
      holding.current = false;
      if (i < script.scenes.length - 1) goTo(i + 1);
      else { p.pause(); setEnded(true); }
    };
    u.onerror = () => { talking.current = false; };
    window.speechSynthesis.speak(u);
  }, [script, silence, goTo]);

  useEffect(() => {
    const p = ref.current;
    if (!p) return;
    const onFrame = (e: { detail: { frame: number } }) => {
      const n = sceneAt(plan, e.detail.frame);
      setScene(n);
      if (!p.isPlaying()) return;
      if (n !== spoken.current) { spoken.current = n; speak(n); }
      const last = plan.scenes[n];
      // the picture reached the end of its scene but the line is still being spoken: hold here until it finishes
      if (e.detail.frame >= last.start + last.frames - 2 && talking.current && live.current.voice) {
        holding.current = true;
        p.pause();
      }
    };
    const onPlay = () => { setPlaying(true); setEnded(false); };
    const onPause = () => {
      setPlaying(false);
      if (holding.current) return; // a hold is not the viewer pausing: keep talking
      if (canSpeak()) window.speechSynthesis.pause();
    };
    const onEnded = () => { setPlaying(false); setEnded(true); silence(); };
    p.addEventListener("frameupdate", onFrame);
    p.addEventListener("play", onPlay);
    p.addEventListener("pause", onPause);
    p.addEventListener("ended", onEnded);
    return () => {
      p.removeEventListener("frameupdate", onFrame);
      p.removeEventListener("play", onPlay);
      p.removeEventListener("pause", onPause);
      p.removeEventListener("ended", onEnded);
    };
  }, [plan, speak, silence]);

  useEffect(() => () => { if (canSpeak()) window.speechSynthesis.cancel(); }, []);

  const toggle = () => {
    const p = ref.current;
    if (!p) return;
    if (ended) return goTo(0);
    if (p.isPlaying()) { p.pause(); return; }
    if (canSpeak()) window.speechSynthesis.resume();
    p.play();
  };

  const toggleVoice = () => {
    const next = !voice;
    setVoice(next);
    if (!next) { silence(); if (holding.current) { holding.current = false; ref.current?.play(); } }
    else spoken.current = -1; // say the current scene's line again from its start
  };

  const total = Math.round(plan.total / EXPLAINER_FPS);
  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-hidden rounded-2xl border border-[var(--m-rule)] bg-[var(--m-ground)] shadow-[0_20px_50px_-28px_rgb(20_20_20/0.5)]">
        <Player
          ref={ref}
          component={Explainer}
          inputProps={{ scenes: script.scenes, title: script.title, plan }}
          durationInFrames={Math.max(plan.total, 1)}
          fps={EXPLAINER_FPS}
          compositionWidth={EXPLAINER_W}
          compositionHeight={EXPLAINER_H}
          playbackRate={speed}
          style={{ width: "100%", aspectRatio: `${EXPLAINER_W} / ${EXPLAINER_H}` }}
          controls={false}
          clickToPlay
          acknowledgeRemotionLicense
        />
        {captions && <p aria-live="off" className="border-t border-[var(--m-rule)] bg-white px-4 py-3 text-[15px] leading-relaxed text-[var(--m-ink)]">{script.scenes[scene]?.say}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <button type="button" onClick={toggle} className="inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[14px] font-bold text-white">
          {ended ? <RotateCcw size={15} aria-hidden /> : playing ? <Pause size={15} aria-hidden /> : <Play size={15} aria-hidden />}
          {ended ? "Watch again" : playing ? "Pause" : scene === 0 && !playing ? "Play" : "Resume"}
        </button>
        {speechSupported && (
          <button type="button" aria-pressed={voice} onClick={toggleVoice} className={clsx("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13.5px] font-bold", voice ? "border-[var(--m-ink)] bg-white text-[var(--m-ink)]" : "border-[var(--m-rule)] text-[var(--m-muted)]")}>
            {voice ? <Volume2 size={15} aria-hidden /> : <VolumeX size={15} aria-hidden />}{voice ? "Voice on" : "Voice off"}
          </button>
        )}
        <button type="button" aria-pressed={captions} onClick={() => setCaptions((c) => !c)} className={clsx("inline-flex items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13.5px] font-bold", captions ? "border-[var(--m-ink)] bg-white text-[var(--m-ink)]" : "border-[var(--m-rule)] text-[var(--m-muted)]")}>
          <Captions size={15} aria-hidden />Captions
        </button>
        <div role="group" aria-label="Speed" className="ml-auto flex overflow-hidden rounded-full border border-[var(--m-rule)]">
          {SPEEDS.map((s) => (
            <button key={s} type="button" aria-pressed={speed === s} onClick={() => setSpeed(s)} className={clsx("ss-num px-3 py-2 text-[13px] font-bold", speed === s ? "bg-[var(--m-ink)] text-white" : "bg-white text-[var(--m-ink)] hover:bg-[var(--m-ground)]")}>{s}×</button>
          ))}
        </div>
      </div>

      <ol aria-label="Scenes" className="flex gap-1.5">
        {script.scenes.map((s, i) => (
          <li key={i} className="flex-1">
            <button type="button" onClick={() => goTo(i)} aria-label={`Scene ${i + 1}: ${s.heading}`} aria-current={i === scene ? "step" : undefined} title={s.heading} className={clsx("h-2 w-full rounded-full transition-colors motion-reduce:transition-none", i < scene ? "bg-[var(--m-ink)]" : i === scene ? "bg-[var(--m-accent)]" : "bg-[var(--m-rule)] hover:bg-[var(--m-soft)]")} />
          </li>
        ))}
      </ol>
      <p className="ss-num text-[12.5px] text-[var(--m-muted)]">About {Math.floor(total / 60)} min {total % 60} s · AI-narrated explainer drawn from the lesson. Read the written lesson for the full detail.</p>
    </div>
  );
}
