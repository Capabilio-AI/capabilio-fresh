"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Mic, MicOff, Phone, PhoneOff, Search, UserPlus, Video, VideoOff, X } from "lucide-react";
import { formatDuration } from "@/lib/pulse/call-rules";
import { MAX_PARTICIPANTS, gridColumns } from "@/lib/pulse/group-call-rules";
import type { SearchResults } from "@/lib/pulse/search";
import { Avatar } from "@/components/pulse/Avatar";
import { useCall, type CallTile } from "./CallProvider";

function Timer({ since }: { since: number | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="font-lp-mono text-[13px] tabular-nums" role="timer">{since ? formatDuration((now - since) / 1000) : "00:00"}</span>;
}

const ROUND = "flex h-14 w-14 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/70";

/** One person: their camera when it is on, otherwise their picture. A ring shows who is speaking. */
function Tile({ tile, small = false }: { tile: CallTile; small?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const el = video.current;
    const track = tile.video;
    if (!el || !track) return;
    track.attach(el);
    return () => { track.detach(el); };
  }, [tile.video]);
  const label = tile.isLocal ? "You" : tile.name ?? "Guest";
  return (
    <div className={`relative flex items-center justify-center overflow-hidden rounded-2xl bg-[#151b2b] ${tile.speaking ? "ring-2 ring-app-success" : "ring-1 ring-white/10"} ${small ? "h-36 w-28 sm:h-44 sm:w-32" : "h-full w-full"}`}>
      {tile.video ? (
        // a video element fed by the call's own track, not a file: no captions apply
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video ref={video} autoPlay playsInline muted={tile.isLocal} className={`h-full w-full object-cover ${tile.isLocal ? "[transform:scaleX(-1)]" : ""}`} />
      ) : (
        <div className="flex flex-col items-center gap-2 p-3 text-center">
          <Avatar person={{ name: tile.name, avatarUrl: tile.avatarUrl }} size={small ? "md" : "xl"} />
          {!small && <p className="font-lp-body text-[14px] font-semibold">{label}</p>}
        </div>
      )}
      <div className="absolute bottom-2 left-2 flex max-w-[85%] items-center gap-1.5 rounded-full bg-black/55 px-2.5 py-1 text-[12px]">
        {!tile.micOn && <MicOff size={12} aria-label="Muted" />}
        <span className="truncate">{label}</span>
      </div>
    </div>
  );
}

/** Search for people and add them to the call; each is rung like a normal call. */
function AddPeople({ onClose }: { onClose: () => void }) {
  const { invite, state } = useCall();
  const [term, setTerm] = useState("");
  const [people, setPeople] = useState<SearchResults["people"]>([]);
  const [searching, setSearching] = useState(false);
  const [status, setStatus] = useState<Record<string, string>>({});
  const q = term.trim();
  const inCall = new Set([...state.tiles.map((t) => t.id), ...state.ringing.map((r) => r.id)]);

  useEffect(() => {
    if (q.length < 2) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (res.ok) setPeople(((await res.json()) as SearchResults).people);
      } catch { /* the next keystroke searches again */ } finally {
        if (!controller.signal.aborted) setSearching(false);
      }
    }, 250);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q]);

  async function add(id: string) {
    setStatus((s) => ({ ...s, [id]: "Adding…" }));
    const problem = await invite([id]);
    setStatus((s) => ({ ...s, [id]: problem ?? "Ringing…" }));
  }

  return (
    <aside aria-label="Add people to the call" className="absolute inset-y-0 right-0 z-10 flex w-full max-w-sm flex-col bg-[#0f1524] shadow-2xl">
      <header className="flex items-center justify-between border-b border-white/10 px-5 py-4">
        <div>
          <h2 className="font-lp-display text-[16px] font-bold">Add people</h2>
          <p className="text-[12px] text-white/60">Up to {MAX_PARTICIPANTS} people in one call.</p>
        </div>
        <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 hover:bg-white/10"><X size={16} aria-hidden /></button>
      </header>
      <label className="relative m-4 block">
        <span className="sr-only">Search people</span>
        <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-white/50" />
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search by name" autoFocus className="w-full rounded-full border border-white/15 bg-white/5 py-2.5 pl-9 pr-4 text-[13.5px] text-white outline-none placeholder:text-white/40 focus:border-white/40" />
      </label>
      <ul className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
        {searching && people.length === 0 && <li className="flex items-center gap-2 px-3 py-3 text-[13px] text-white/60"><Loader2 size={14} className="animate-spin" aria-hidden />Searching…</li>}
        {q.length >= 2 && !searching && people.length === 0 && <li className="px-3 py-3 text-[13px] text-white/60">No one found.</li>}
        {q.length < 2 && <li className="px-3 py-3 text-[13px] text-white/60">Type at least two letters.</li>}
        {(q.length >= 2 ? people : []).map((p) => (
          <li key={p.id} className="flex items-center gap-3 rounded-xl px-3 py-2">
            <Avatar person={p} size="md" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13.5px] font-semibold">{p.name ?? "Capabilio member"}</p>
              <p className="truncate text-[12px] text-white/55">{status[p.id] ?? p.headline ?? ""}</p>
            </div>
            {inCall.has(p.id) ? <span className="text-[12px] text-white/55">In call</span> : (
              <button type="button" onClick={() => void add(p.id)} disabled={status[p.id] === "Adding…" || status[p.id] === "Ringing…"} className="rounded-full bg-white px-3.5 py-1.5 text-[12.5px] font-semibold text-[#0b0f19] hover:opacity-90 disabled:opacity-50">Add</button>
            )}
          </li>
        ))}
      </ul>
    </aside>
  );
}

/** Ringing, in-call and notice UI for voice and video calls, one to one or in a group. Mounted once in the app shell. */
export function CallOverlay() {
  const { state, accept, decline, hangup, toggleMute, toggleCamera, dismissNotice } = useCall();
  const [adding, setAdding] = useState(false);
  const { phase, peer, kind, tiles, ringing } = state;
  const name = peer?.name ?? "Someone";
  const person = peer ?? { name: null, avatarUrl: null };
  const remote = tiles.filter((t) => !t.isLocal);
  const local = tiles.find((t) => t.isLocal);
  const duo = tiles.length === 2 && Boolean(remote[0]);
  const title = tiles.length > 2 ? `Group call · ${tiles.length} people` : remote[0]?.name ?? name;

  return (
    <>
      {state.notice && (
        <div role="alert" className="fixed left-1/2 top-4 z-[70] flex max-w-sm -translate-x-1/2 items-center gap-3 rounded-xl bg-app-charcoal px-4 py-3 text-white shadow-xl">
          <p className="font-lp-body text-[13px]">{state.notice}</p>
          <button type="button" onClick={dismissNotice} aria-label="Dismiss" className="rounded-full p-1 hover:bg-white/10"><X size={14} /></button>
        </div>
      )}

      {phase === "incoming" && (
        <div role="alertdialog" aria-label={`Incoming ${kind} call from ${name}`} className="fixed bottom-6 left-1/2 z-[70] flex w-[min(92vw,400px)] -translate-x-1/2 items-center gap-4 rounded-2xl bg-app-charcoal p-4 text-white shadow-2xl">
          <Avatar person={person} size="md" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-lp-body text-[14px] font-semibold">{name}</p>
            <p className="font-lp-body text-[12px] text-white/70">{state.group ? `added you to a ${kind} call…` : `Incoming ${kind} call…`}</p>
          </div>
          <button type="button" onClick={decline} aria-label="Decline call" className={`${ROUND} bg-app-rose text-white hover:opacity-90`}><PhoneOff size={20} /></button>
          <button type="button" onClick={() => void accept()} aria-label="Accept call" autoFocus className={`${ROUND} bg-app-success text-white hover:opacity-90`}>{kind === "video" ? <Video size={20} /> : <Phone size={20} />}</button>
        </div>
      )}

      {(phase === "outgoing" || phase === "connecting" || phase === "active") && (
        <div role="dialog" aria-modal="true" aria-label={`${kind === "video" ? "Video" : "Voice"} call: ${title}`} className="fixed inset-0 z-[70] flex flex-col bg-[#0b0f19] text-white">
          <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
            {phase !== "active" ? (
              <div className="flex flex-col items-center gap-4">
                <Avatar person={person} size="xl" />
                <p className="font-lp-display text-[22px] font-semibold">{name}</p>
                <p className="text-[14px] text-white/70" aria-live="polite">{phase === "outgoing" ? "Calling…" : "Connecting…"}</p>
              </div>
            ) : duo && remote[0] ? (
              <>
                <div className="absolute inset-0 p-2"><Tile tile={remote[0]} /></div>
                {local && <div className="absolute bottom-4 right-4"><Tile tile={local} small /></div>}
              </>
            ) : (
              <ul className="grid h-full w-full gap-2 p-2" style={{ gridTemplateColumns: `repeat(${gridColumns(tiles.length)}, minmax(0, 1fr))`, gridAutoRows: "1fr" }}>
                {tiles.map((t) => <li key={t.id} className="min-h-0"><Tile tile={t} /></li>)}
              </ul>
            )}
            <div className="pointer-events-none absolute inset-x-0 top-0 flex items-center justify-between bg-gradient-to-b from-black/60 to-transparent px-5 py-4">
              <div className="min-w-0">
                <p className="truncate font-lp-body text-[14px] font-semibold">{title}</p>
                {ringing.length > 0 && <p className="truncate text-[12px] text-white/70">Ringing: {ringing.map((r) => r.name ?? "someone").join(", ")}</p>}
              </div>
              {phase === "active" && <p className="text-white/80" aria-live="polite"><Timer since={state.startedAt} /></p>}
            </div>
            {adding && <AddPeople onClose={() => setAdding(false)} />}
          </div>
          <div className="flex items-center justify-center gap-4 bg-black/40 px-6 py-5">
            {phase === "active" && (
              <>
                <button type="button" onClick={toggleMute} aria-pressed={state.muted} aria-label={state.muted ? "Unmute microphone" : "Mute microphone"} className={`${ROUND} ${state.muted ? "bg-white text-[#0b0f19]" : "bg-white/15 hover:bg-white/25"}`}>{state.muted ? <MicOff size={22} /> : <Mic size={22} />}</button>
                <button type="button" onClick={toggleCamera} aria-pressed={state.cameraOff} aria-label={state.cameraOff ? "Turn camera on" : "Turn camera off"} className={`${ROUND} ${state.cameraOff ? "bg-white/15 hover:bg-white/25" : "bg-white text-[#0b0f19]"}`}>{state.cameraOff ? <VideoOff size={22} /> : <Video size={22} />}</button>
                <button type="button" onClick={() => setAdding((v) => !v)} aria-pressed={adding} aria-label="Add people to the call" className={`${ROUND} ${adding ? "bg-white text-[#0b0f19]" : "bg-white/15 hover:bg-white/25"}`}><UserPlus size={22} /></button>
              </>
            )}
            <button type="button" onClick={hangup} aria-label={phase === "outgoing" ? "Cancel call" : "End call"} className={`${ROUND} bg-app-rose text-white hover:opacity-90`}><PhoneOff size={22} /></button>
          </div>
        </div>
      )}
    </>
  );
}
