import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { EXPLAINER_H, EXPLAINER_W, planExplainer, type ExplainerPlan, type VideoScene } from "@/lib/skillstudio/lesson-content";

// The explainer's look: the app's own palette, drawn live from the script. No video file exists; the same composition can be rendered
// to MP4 on a server later without changing it.
const INK = "#141414";
const GROUND = "#f5f6f1";
const ACCENT = "#ff5701";
const MUTED = "#5c5c55";
const RULE = "#e1e1da";
const PAD = 84;
const FADE = 8;

const ease = (frame: number, from: number, to: number) => interpolate(frame, [from, to], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });

function Reveal({ i, children }: { i: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const t = ease(f, 12 + i * 14, 28 + i * 14);
  return <div style={{ opacity: t, transform: `translateY(${(1 - t) * 18}px)` }}>{children}</div>;
}

const Heading = ({ children, size = 64 }: { children: React.ReactNode; size?: number }) => (
  <h2 className="font-lp-display" style={{ margin: 0, fontSize: size, lineHeight: 1.06, fontWeight: 700, letterSpacing: "-0.025em", color: INK, maxWidth: 1000 }}>{children}</h2>
);

function Points({ points, numbered }: { points: string[]; numbered?: boolean }) {
  return (
    <ul style={{ listStyle: "none", margin: "44px 0 0", padding: 0, display: "flex", flexDirection: "column", gap: 24 }}>
      {points.map((p, i) => (
        <li key={i}>
          <Reveal i={i}>
            <div style={{ display: "flex", alignItems: "flex-start", gap: 22 }}>
              <span className="font-lp-display" style={{ flexShrink: 0, width: 46, height: 46, borderRadius: 23, background: numbered ? ACCENT : INK, color: numbered ? INK : "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 24, fontWeight: 700 }}>{numbered ? i + 1 : <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}</span>
              <span className="font-lp-body" style={{ fontSize: 36, lineHeight: 1.25, color: INK, maxWidth: 940 }}>{p}</span>
            </div>
          </Reveal>
        </li>
      ))}
    </ul>
  );
}

function Code({ code }: { code: string }) {
  const f = useCurrentFrame();
  const shown = code.slice(0, Math.floor(f * 2.4));
  return (
    <pre className="font-lp-mono" style={{ margin: "36px 0 0", padding: "30px 36px", borderRadius: 20, background: INK, color: "#fff", fontSize: 28, lineHeight: 1.5, whiteSpace: "pre-wrap", maxWidth: 1050, minHeight: 120 }}>{shown}<span style={{ color: ACCENT }}>▌</span></pre>
  );
}

function SceneBody({ s, title }: { s: VideoScene; title: string }) {
  if (s.kind === "title") {
    return (
      <div style={{ display: "flex", flexDirection: "column", justifyContent: "center", height: "100%" }}>
        <Reveal i={0}><span className="font-lp-body" style={{ fontSize: 28, fontWeight: 700, color: ACCENT }}>Capabilio SkillStudio</span></Reveal>
        <div style={{ marginTop: 22 }}><Reveal i={1}><Heading size={92}>{s.heading || title}</Heading></Reveal></div>
        {s.points[0] && <div style={{ marginTop: 28 }}><Reveal i={3}><p className="font-lp-body" style={{ margin: 0, fontSize: 34, color: MUTED, maxWidth: 900 }}>{s.points[0]}</p></Reveal></div>}
      </div>
    );
  }
  return (
    <div style={{ paddingTop: 36 }}>
      <Heading>{s.heading}</Heading>
      {s.kind === "example" && s.code ? <Code code={s.code} /> : null}
      {s.points.length > 0 && <Points points={s.points} numbered={s.kind === "steps"} />}
    </div>
  );
}

function Rail({ total }: { total: number }) {
  const f = useCurrentFrame();
  return (
    <div style={{ position: "absolute", left: PAD, right: PAD, bottom: 36, height: 8, borderRadius: 4, background: RULE }} aria-hidden>
      <div style={{ width: `${Math.min(100, (f / total) * 100)}%`, height: "100%", borderRadius: 4, background: ACCENT }} />
    </div>
  );
}

function Fade({ frames, children }: { frames: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const opacity = Math.min(ease(f, 0, FADE), 1 - ease(f, frames - FADE, frames));
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

export function Explainer({ scenes, title, plan }: { scenes: VideoScene[]; title: string; plan?: ExplainerPlan }) {
  const p = plan ?? planExplainer({ scenes });
  return (
    <AbsoluteFill style={{ background: GROUND, width: EXPLAINER_W, height: EXPLAINER_H, overflow: "hidden" }}>
      {scenes.map((s, n) => (
        <Sequence key={n} from={p.scenes[n].start} durationInFrames={p.scenes[n].frames}>
          <Fade frames={p.scenes[n].frames}>
            <div style={{ position: "absolute", inset: 0, padding: `${PAD - 24}px ${PAD}px` }}><SceneBody s={s} title={title} /></div>
          </Fade>
        </Sequence>
      ))}
      <Rail total={p.total} />
    </AbsoluteFill>
  );
}
