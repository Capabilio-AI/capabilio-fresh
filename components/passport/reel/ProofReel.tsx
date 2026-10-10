import { AbsoluteFill, interpolate, Sequence, useCurrentFrame } from "remotion";
import { planReel, REEL_H, sceneStarts, type Limits, type ReelInput, type ReelPlan, type SceneKind } from "@/lib/passport/reel";
import { ArenaScene, BadgesScene, GithubScene, IntroScene, InterviewsScene, MomentumScene, OutroScene, ProofsScene, StartScene } from "./scenes";
import { INK, ORANGE, WHITE, FAINT } from "./theme";

const RAIL_X = 120;
const RAIL_TOP = 150;
const RAIL_BOTTOM = REEL_H - 150;
const FADE = 9;

const SCENES: Record<SceneKind, (p: { i: ReelInput; limits: Limits }) => React.ReactElement> = {
  intro: IntroScene, start: StartScene, badges: BadgesScene, momentum: MomentumScene, arena: ArenaScene, proofs: ProofsScene, interviews: InterviewsScene, github: GithubScene, outro: OutroScene,
};

/** The Capabilio line, as the film's timeline: it fills as the reel plays and every scene is a station on it. */
function Rail({ plan }: { plan: ReelPlan }) {
  const frame = useCurrentFrame();
  const progress = frame / plan.totalFrames;
  const len = RAIL_BOTTOM - RAIL_TOP;
  const stations = sceneStarts(plan).map((f) => f / plan.totalFrames);
  return (
    <svg width={240} height={REEL_H} style={{ position: "absolute", left: 0, top: 0 }} aria-hidden>
      <line x1={RAIL_X} y1={RAIL_TOP} x2={RAIL_X} y2={RAIL_BOTTOM} stroke={FAINT} strokeWidth={10} strokeLinecap="round" />
      <line x1={RAIL_X} y1={RAIL_TOP} x2={RAIL_X} y2={RAIL_TOP + len * progress} stroke={ORANGE} strokeWidth={10} strokeLinecap="round" />
      {stations.map((at, n) => {
        const reached = progress >= at;
        return <circle key={n} cx={RAIL_X} cy={RAIL_TOP + len * at} r={reached ? 20 : 16} fill={INK} stroke={reached ? WHITE : FAINT} strokeWidth={7} />;
      })}
    </svg>
  );
}

function Fade({ frames, children }: { frames: number; children: React.ReactNode }) {
  const f = useCurrentFrame();
  const opacity = Math.min(interpolate(f, [0, FADE], [0, 1], { extrapolateRight: "clamp" }), interpolate(f, [frames - FADE, frames], [1, 0], { extrapolateLeft: "clamp" }));
  return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
}

export function ProofReel({ input }: { input: ReelInput }) {
  const plan = planReel(input);
  const starts = sceneStarts(plan);
  return (
    <AbsoluteFill style={{ background: INK, overflow: "hidden" }}>
      <Rail plan={plan} />
      {plan.scenes.map((s, n) => {
        const Scene = SCENES[s.kind];
        return (
          <Sequence key={n} from={starts[n]} durationInFrames={s.frames}>
            <Fade frames={s.frames}><Scene i={input} limits={plan.limits} /></Fade>
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}
