import { AbsoluteFill, Easing, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BadgeMark } from "@/components/profile/Badge";
import type { Limits, ReelInput } from "@/lib/passport/reel";
import { BODY, COL_W, DIM, DISPLAY, FAINT, LEFT, ORANGE, WHITE } from "./theme";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
/** 0 to 1 over `len` frames starting at `from`, easing out. */
export const ease = (frame: number, from: number, len = 18) => interpolate(frame, [from, from + len], [0, 1], { ...clamp, easing: Easing.out(Easing.cubic) });

function Reveal({ at, children, y = 36 }: { at: number; children: React.ReactNode; y?: number }) {
  const t = ease(useCurrentFrame(), at);
  return <div style={{ opacity: t, transform: `translateY(${(1 - t) * y}px)` }}>{children}</div>;
}

const Heading = ({ children }: { children: React.ReactNode }) => (
  <h2 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 92, lineHeight: 1.04, fontWeight: 700, letterSpacing: "-0.02em", color: WHITE }}>{children}</h2>
);
const Label = ({ children, color = DIM }: { children: React.ReactNode; color?: string }) => (
  <p style={{ margin: 0, fontFamily: BODY, fontSize: 30, fontWeight: 700, letterSpacing: "0.16em", textTransform: "uppercase", color }}>{children}</p>
);
const Frame = ({ children, gap = 44 }: { children: React.ReactNode; gap?: number }) => (
  <AbsoluteFill style={{ left: LEFT, width: COL_W, justifyContent: "center", display: "flex", flexDirection: "column", gap }}>{children}</AbsoluteFill>
);

export function IntroScene({ i }: { i: ReelInput }) {
  const h = i.holder;
  const facts = [h.college, h.branch, h.classOf ? `Class of ${h.classOf}` : null].filter(Boolean).join(" · ");
  return (
    <Frame gap={36}>
      <Reveal at={4}><Label color={ORANGE}>Capabilio digital skill passport</Label></Reveal>
      <Reveal at={14}><h1 style={{ margin: 0, fontFamily: DISPLAY, fontSize: 138, lineHeight: 0.98, fontWeight: 800, letterSpacing: "-0.035em", color: WHITE, overflowWrap: "anywhere" }}>{h.name}</h1></Reveal>
      {h.aspiringFor && <Reveal at={30}><p style={{ margin: 0, fontFamily: DISPLAY, fontSize: 56, fontWeight: 600, color: ORANGE }}>Aspiring {h.aspiringFor}</p></Reveal>}
      {facts && <Reveal at={40}><p style={{ margin: 0, fontFamily: BODY, fontSize: 38, lineHeight: 1.35, color: DIM }}>{facts}</p></Reveal>}
      <Reveal at={52}><span style={{ display: "inline-block", border: `2px solid ${FAINT}`, borderRadius: 14, padding: "12px 24px", fontFamily: DISPLAY, fontSize: 38, fontWeight: 700, color: WHITE, fontVariantNumeric: "tabular-nums" }}>{h.passportNo}</span></Reveal>
    </Frame>
  );
}

export function BadgesScene({ i, limits }: { i: ReelInput; limits: Limits }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const shown = i.badges.slice(0, limits.badges);
  return (
    <Frame gap={56}>
      <Reveal at={2}><Heading>Measured,<br />not claimed.</Heading></Reveal>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px 28px" }}>
        {shown.map((b, n) => {
          const s = spring({ frame: frame - (28 + n * 12), fps, config: { damping: 13, stiffness: 140 } });
          return (
            <div key={b.name} style={{ display: "flex", alignItems: "center", gap: 22, opacity: Math.min(1, s * 1.4), transform: `scale(${0.6 + 0.4 * s})`, transformOrigin: "left center" }}>
              <BadgeMark level={b.level} size={150} onDark />
              <div style={{ minWidth: 0 }}>
                <p style={{ margin: 0, fontFamily: DISPLAY, fontSize: 42, fontWeight: 700, lineHeight: 1.08, color: WHITE, overflowWrap: "anywhere" }}>{b.name}</p>
                <p style={{ margin: "6px 0 0", fontFamily: BODY, fontSize: 28, color: DIM }}>{b.level}{b.provisional ? " · provisional" : ""}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Frame>
  );
}

const CHART_W = COL_W;
const CHART_H = 360;

export function MomentumScene({ i }: { i: ReelInput }) {
  const frame = useCurrentFrame();
  const hist = i.elo?.history ?? [];
  const lo = Math.min(...hist, 0) === 0 && hist.length ? Math.min(...hist) : Math.min(...hist);
  const hi = Math.max(...hist, lo + 1);
  const pts = hist.map((v, n) => [(n / Math.max(hist.length - 1, 1)) * CHART_W, CHART_H - 20 - ((v - lo) / (hi - lo)) * (CHART_H - 40)] as const);
  const d = pts.map(([x, y], n) => `${n ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join("");
  const draw = ease(frame, 24, 60);
  const count = Math.round(i.arenaPassed * ease(frame, 10, 40));
  const rating = hist.length ? Math.round(hist[0] + (hist[hist.length - 1] - hist[0]) * draw) : 0;
  return (
    <Frame gap={48}>
      <Reveal at={2}><Heading>Proof<br />in motion.</Heading></Reveal>
      {i.arenaPassed > 0 && (
        <Reveal at={8}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
            <span style={{ fontFamily: DISPLAY, fontSize: 210, fontWeight: 800, lineHeight: 0.9, color: ORANGE, fontVariantNumeric: "tabular-nums" }}>{count}</span>
            <span style={{ fontFamily: BODY, fontSize: 40, lineHeight: 1.2, color: DIM }}>Arena challenge{i.arenaPassed === 1 ? "" : "s"}<br />passed</span>
          </div>
        </Reveal>
      )}
      {pts.length >= 2 && (
        <Reveal at={20}>
          <div>
            <Label>Career rating {hist[0]} → {rating}</Label>
            <svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} style={{ marginTop: 18, overflow: "visible" }}>
              <path d={d} pathLength={1} fill="none" stroke={ORANGE} strokeWidth={8} strokeLinecap="round" strokeLinejoin="round" strokeDasharray={1} strokeDashoffset={1 - draw} />
              {draw > 0.98 && <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r={14} fill={WHITE} stroke={ORANGE} strokeWidth={6} />}
            </svg>
          </div>
        </Reveal>
      )}
    </Frame>
  );
}

export function ProofsScene({ i, limits }: { i: ReelInput; limits: Limits }) {
  const shown = i.proofs.slice(0, limits.proofs);
  return (
    <Frame gap={48}>
      <Reveal at={2}><Heading>Proof<br />of work.</Heading></Reveal>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {shown.map((p, n) => (
          <Reveal key={p.title + n} at={22 + n * 18} y={0}>
            <ProofCard title={p.title} kind={p.kind} delay={22 + n * 18} />
          </Reveal>
        ))}
      </div>
    </Frame>
  );
}

function ProofCard({ title, kind, delay }: { title: string; kind: string; delay: number }) {
  const slide = 1 - ease(useCurrentFrame(), delay, 22);
  return (
    <div style={{ transform: `translateX(${slide * 120}px)`, display: "flex", alignItems: "center", gap: 28, border: `2px solid ${FAINT}`, borderRadius: 24, padding: "28px 32px", background: "rgba(255,255,255,0.05)" }}>
      <svg width="64" height="64" viewBox="0 0 64 64" aria-hidden><circle cx="32" cy="32" r="28" fill={ORANGE} /><path d="M20 33l8 8 17-18" fill="none" stroke={WHITE} strokeWidth="6" strokeLinecap="round" strokeLinejoin="round" /></svg>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontFamily: DISPLAY, fontSize: 44, fontWeight: 700, lineHeight: 1.1, color: WHITE, overflowWrap: "anywhere" }}>{title}</p>
        <p style={{ margin: "8px 0 0", fontFamily: BODY, fontSize: 28, color: DIM, textTransform: "capitalize" }}>Verified {kind}</p>
      </div>
    </div>
  );
}

export function GithubScene({ i }: { i: ReelInput }) {
  const g = i.github!;
  return (
    <Frame gap={40}>
      <Reveal at={2}><Heading>Code,<br />verified.</Heading></Reveal>
      <Reveal at={20}><p style={{ margin: 0, fontFamily: DISPLAY, fontSize: 84, fontWeight: 700, color: ORANGE, overflowWrap: "anywhere" }}>@{g.username}</p></Reveal>
      {g.repositories ? <Reveal at={32}><p style={{ margin: 0, fontFamily: BODY, fontSize: 44, lineHeight: 1.3, color: DIM }}>{g.repositories} repositories analysed by Capabilio, from real commits and pull requests.</p></Reveal> : null}
    </Frame>
  );
}

export function OutroScene({ i }: { i: ReelInput }) {
  return (
    <Frame gap={44}>
      <Reveal at={2}><Heading>Every frame<br />came from<br />evidence.</Heading></Reveal>
      <Reveal at={26}><p style={{ margin: 0, fontFamily: BODY, fontSize: 40, lineHeight: 1.35, color: DIM }}>Nothing here is self-reported. Scan the passport again any time: this page always shows the latest verified record.</p></Reveal>
      <Reveal at={46}>
        <div style={{ borderTop: `2px solid ${FAINT}`, paddingTop: 28 }}>
          <Label>Evidence fingerprint</Label>
          <p style={{ margin: "10px 0 0", fontFamily: "ui-monospace, 'JetBrains Mono', monospace", fontSize: 42, fontWeight: 600, color: ORANGE, letterSpacing: "0.04em" }}>{i.fingerprint}</p>
          {i.measuredAt && <p style={{ margin: "10px 0 0", fontFamily: BODY, fontSize: 30, color: DIM }}>Measured {i.measuredAt.slice(0, 10)}</p>}
        </div>
      </Reveal>
    </Frame>
  );
}

export function StartScene() {
  const steps = ["Take the career assessment", "Pass Arena challenges", "Build and verify real projects"];
  return (
    <Frame gap={48}>
      <Reveal at={2}><Heading>Just getting<br />started.</Heading></Reveal>
      <Reveal at={22}><p style={{ margin: 0, fontFamily: BODY, fontSize: 42, lineHeight: 1.35, color: DIM }}>Nothing is verified yet, so nothing is shown. This film grows as evidence is added.</p></Reveal>
      <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
        {steps.map((t, n) => (
          <Reveal key={t} at={44 + n * 16}>
            <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
              <span style={{ width: 56, height: 56, borderRadius: 28, border: `4px dashed ${ORANGE}`, display: "inline-block", flexShrink: 0 }} />
              <span style={{ fontFamily: DISPLAY, fontSize: 46, fontWeight: 600, color: WHITE }}>{t}</span>
            </div>
          </Reveal>
        ))}
      </div>
    </Frame>
  );
}

export function ArenaScene({ i, limits }: { i: ReelInput; limits: Limits }) {
  const shown = i.arena.slice(0, limits.arena);
  return (
    <Frame gap={48}>
      <Reveal at={2}><Heading>Real<br />challenges.</Heading></Reveal>
      <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {shown.map((a, n) => (
          <Reveal key={a.title + n} at={20 + n * 16}>
            <div style={{ borderTop: `2px solid ${FAINT}`, paddingTop: 22 }}>
              <p style={{ margin: 0, fontFamily: DISPLAY, fontSize: 44, fontWeight: 700, lineHeight: 1.1, color: WHITE, overflowWrap: "anywhere" }}>{a.title}</p>
              <p style={{ margin: "8px 0 0", fontFamily: BODY, fontSize: 28, color: ORANGE }}>{[a.area, a.company].filter(Boolean).join(" · ")}</p>
            </div>
          </Reveal>
        ))}
      </div>
    </Frame>
  );
}

export function InterviewsScene({ i }: { i: ReelInput }) {
  const iv = i.interviews!;
  const frame = useCurrentFrame();
  const score = Math.round(iv.best * ease(frame, 14, 40));
  return (
    <Frame gap={48}>
      <Reveal at={2}><Heading>Interview<br />practice.</Heading></Reveal>
      <Reveal at={10}>
        <div style={{ display: "flex", alignItems: "baseline", gap: 24 }}>
          <span style={{ fontFamily: DISPLAY, fontSize: 210, fontWeight: 800, lineHeight: 0.9, color: ORANGE, fontVariantNumeric: "tabular-nums" }}>{score}</span>
          <span style={{ fontFamily: BODY, fontSize: 40, lineHeight: 1.2, color: DIM }}>best score<br />out of 100</span>
        </div>
      </Reveal>
      <Reveal at={30}><p style={{ margin: 0, fontFamily: BODY, fontSize: 40, color: DIM }}>{iv.count} mock interview{iv.count === 1 ? "" : "s"} · average {iv.average}</p></Reveal>
    </Frame>
  );
}
