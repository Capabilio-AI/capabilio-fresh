"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Player, type PlayerRef } from "@remotion/player";
import { Volume2, VolumeX } from "lucide-react";
import { planReel, REEL_FPS, REEL_H, REEL_W, sceneAt, type ReelInput } from "@/lib/passport/reel";
import { ProofReel } from "./ProofReel";

const QUERY = "(prefers-reduced-motion: reduce)";
const motionAllowed = () => !window.matchMedia(QUERY).matches;
const subscribeMotion = (notify: () => void) => {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", notify);
  return () => mq.removeEventListener("change", notify);
};
const noopSubscribe = () => () => {};
const canSpeak = () => "speechSynthesis" in window;

const VOICE_RATE = 0.98;
const PREFERRED_VOICE = /natural|neural|google|samantha|daniel|karen|moira|microsoft (aria|jenny|guy)/i;

/** The browser's own voice (free, nothing leaves the device): English first, and a natural-sounding one when the device has it. */
function pickVoice(): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("en"));
  return voices.find((v) => PREFERRED_VOICE.test(v.name)) ?? voices.find((v) => v.localService) ?? voices[0];
}

/** Plays the proof reel in the page (no video file: it is drawn live from the evidence), with an optional voice-over. Autoplays muted unless the viewer prefers reduced motion. */
export function ReelPlayer({ input, className = "" }: { input: ReelInput; className?: string }) {
  const ref = useRef<PlayerRef>(null);
  const autoPlay = useSyncExternalStore(subscribeMotion, motionAllowed, () => false);
  const speechSupported = useSyncExternalStore(noopSubscribe, canSpeak, () => false);
  const [voice, setVoice] = useState(false);
  const plan = planReel(input);

  // The voice follows the film: each scene's line starts when the scene does, and stops on pause, seek or end.
  useEffect(() => {
    const player = ref.current;
    if (!voice || !player) return;
    let spokenScene = -1;
    const stop = () => { window.speechSynthesis.cancel(); spokenScene = -1; };
    const speak = (n: number) => {
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(plan.scenes[n].say);
      u.voice = pickVoice() ?? null;
      u.lang = u.voice?.lang ?? "en-US";
      u.rate = VOICE_RATE;
      window.speechSynthesis.speak(u);
    };
    const onFrame = (e: { detail: { frame: number } }) => {
      if (!player.isPlaying()) return;
      const n = sceneAt(plan, e.detail.frame);
      if (n !== spokenScene) { spokenScene = n; speak(n); }
    };
    player.addEventListener("frameupdate", onFrame);
    player.addEventListener("pause", stop);
    player.addEventListener("ended", stop);
    player.addEventListener("seeked", stop);
    return () => {
      player.removeEventListener("frameupdate", onFrame);
      player.removeEventListener("pause", stop);
      player.removeEventListener("ended", stop);
      player.removeEventListener("seeked", stop);
      window.speechSynthesis.cancel();
    };
  }, [voice, plan]);

  const toggleVoice = () => {
    const next = !voice;
    setVoice(next);
    if (next) {
      ref.current?.seekTo(0);
      ref.current?.play();
    }
  };

  return (
    <div className={className}>
      <div className="overflow-hidden rounded-2xl bg-[var(--m-ink)] shadow-[0_20px_50px_-20px_rgba(20,20,20,0.6)]">
        <Player
          ref={ref}
          component={ProofReel}
          inputProps={{ input }}
          durationInFrames={plan.totalFrames}
          fps={REEL_FPS}
          compositionWidth={REEL_W}
          compositionHeight={REEL_H}
          style={{ width: "100%", aspectRatio: `${REEL_W} / ${REEL_H}` }}
          controls
          loop
          autoPlay={autoPlay}
          clickToPlay
          acknowledgeRemotionLicense
        />
      </div>
      {speechSupported && (
        <button type="button" onClick={toggleVoice} aria-pressed={voice}
          className={`mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 font-lp-body text-[13.5px] font-bold ${voice ? "bg-[var(--m-accent)] text-white" : "bg-white text-[var(--m-ink)] hover:bg-[var(--m-ground)]"}`}>
          {voice ? <Volume2 size={16} aria-hidden /> : <VolumeX size={16} aria-hidden />}
          {voice ? "Voice-over on" : "Play with voice-over"}
        </button>
      )}
      <p className="mt-2 font-lp-body text-[12px] text-[var(--m-muted)]">{Math.round(plan.totalFrames / REEL_FPS)} seconds · built from {plan.scenes.length - 2 > 0 ? "verified evidence" : "your record so far"}</p>
      <details className="mt-2 font-lp-body text-[13px] text-[var(--m-muted)]">
        <summary className="cursor-pointer font-bold text-[var(--m-ink)]">Read this reel as text</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5">{plan.scenes.map((s) => <li key={s.kind}>{s.say}</li>)}</ul>
      </details>
    </div>
  );
}
