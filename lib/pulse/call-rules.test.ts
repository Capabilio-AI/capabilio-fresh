import { describe, expect, it } from "vitest";
import { callLogText, canStartCall, formatDuration, isLive, transition, type CallStatus } from "./call-rules";

const call = (status: CallStatus) => ({ status, callerId: "a", calleeId: "b" });

describe("transition", () => {
  it("only the callee answers a ringing call; declining and ending a ring both decline it", () => {
    expect(transition(call("ringing"), "b", "accept")).toEqual({ ok: true, status: "accepted" });
    expect(transition(call("ringing"), "b", "decline")).toEqual({ ok: true, status: "declined" });
    expect(transition(call("ringing"), "b", "end")).toEqual({ ok: true, status: "declined" });
    expect(transition(call("ringing"), "a", "accept").ok).toBe(false);
  });
  it("the caller cancels before it is answered, and cannot decline their own call", () => {
    expect(transition(call("ringing"), "a", "cancel")).toEqual({ ok: true, status: "cancelled" });
    expect(transition(call("ringing"), "a", "end")).toEqual({ ok: true, status: "cancelled" });
    expect(transition(call("ringing"), "a", "decline").ok).toBe(false);
  });
  it("either side ends an accepted call; nothing changes a finished one", () => {
    expect(transition(call("accepted"), "a", "end")).toEqual({ ok: true, status: "ended" });
    expect(transition(call("accepted"), "b", "end")).toEqual({ ok: true, status: "ended" });
    expect(transition(call("accepted"), "b", "accept").ok).toBe(false);
    for (const s of ["ended", "declined", "cancelled", "missed"] as const) expect(transition(call(s), "a", "end").ok).toBe(false);
  });
  it("strangers see 'not found'", () => {
    expect(transition(call("accepted"), "z", "end")).toEqual({ ok: false, message: "Call not found." });
  });
});

describe("isLive", () => {
  const now = new Date("2026-10-07T12:00:00Z").getTime();
  it("a ringing call is live for a minute, an accepted one for hours, anything else never", () => {
    expect(isLive({ status: "ringing", created_at: "2026-10-07T11:59:30Z", answered_at: null }, now)).toBe(true);
    expect(isLive({ status: "ringing", created_at: "2026-10-07T11:58:00Z", answered_at: null }, now)).toBe(false);
    expect(isLive({ status: "accepted", created_at: "2026-10-07T09:00:00Z", answered_at: "2026-10-07T09:01:00Z" }, now)).toBe(true);
    expect(isLive({ status: "accepted", created_at: "2026-10-07T01:00:00Z", answered_at: "2026-10-07T01:01:00Z" }, now)).toBe(false);
    expect(isLive({ status: "ended", created_at: "2026-10-07T11:59:59Z", answered_at: null }, now)).toBe(false);
  });
});

describe("canStartCall", () => {
  const ok = { conversationStatus: "accepted" as const, blocked: false, callerBusy: false, calleeBusy: false };
  it("needs an accepted conversation, no block, and both people free", () => {
    expect(canStartCall(ok).allow).toBe(true);
    expect(canStartCall({ ...ok, conversationStatus: "pending" }).allow).toBe(false);
    expect(canStartCall({ ...ok, conversationStatus: null }).allow).toBe(false);
    expect(canStartCall({ ...ok, blocked: true }).allow).toBe(false);
    expect(canStartCall({ ...ok, callerBusy: true }).allow).toBe(false);
    expect(canStartCall({ ...ok, calleeBusy: true }).allow).toBe(false);
  });
});

describe("log text", () => {
  it("formats durations and the line left in the conversation", () => {
    expect(formatDuration(272)).toBe("4:32");
    expect(formatDuration(3725)).toBe("1:02:05");
    expect(callLogText("voice", "ended", 272)).toBe("Voice call · 4:32");
    expect(callLogText("video", "missed", null)).toBe("Missed video call");
    expect(callLogText("voice", "cancelled", null)).toBe("Missed voice call");
    expect(callLogText("video", "declined", null)).toBe("Declined video call");
  });
});
