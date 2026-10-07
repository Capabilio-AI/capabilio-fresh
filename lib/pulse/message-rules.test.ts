import { describe, expect, it } from "vitest";
import { decideSend, pairOf, previewOf, sideOf, type ConversationState } from "./message-rules";

const base = { me: "a", blocked: false, recipientFollowsMe: false };
const convo = (over: Partial<ConversationState>): ConversationState => ({ status: "pending", requestedBy: "a", requesterMessages: 0, ...over });

describe("decideSend", () => {
  it("a first message to a stranger is a request; to someone who follows you it is a direct chat", () => {
    expect(decideSend({ ...base, conversation: null })).toEqual({ allow: true, status: "pending" });
    expect(decideSend({ ...base, recipientFollowsMe: true, conversation: null })).toEqual({ allow: true, status: "accepted" });
  });
  it("never when blocked, whatever the state", () => {
    expect(decideSend({ ...base, blocked: true, conversation: null }).allow).toBe(false);
    expect(decideSend({ ...base, blocked: true, conversation: convo({ status: "accepted" }) }).allow).toBe(false);
  });
  it("an accepted conversation is open both ways", () => {
    expect(decideSend({ ...base, conversation: convo({ status: "accepted" }) })).toEqual({ allow: true, status: "accepted" });
    expect(decideSend({ ...base, conversation: convo({ status: "accepted", requestedBy: "b" }) })).toEqual({ allow: true, status: "accepted" });
  });
  it("a pending request gives the requester exactly one message", () => {
    expect(decideSend({ ...base, conversation: convo({ requesterMessages: 0 }) }).allow).toBe(true);
    const second = decideSend({ ...base, conversation: convo({ requesterMessages: 1 }) });
    expect(second.allow).toBe(false);
  });
  it("the person who received a request must accept or decline before replying", () => {
    const r = decideSend({ ...base, conversation: convo({ requestedBy: "b", requesterMessages: 1 }) });
    expect(r).toEqual({ allow: false, message: "Accept or decline their request to reply." });
  });
  it("a declined requester is shut out, but the person who declined may reopen it", () => {
    expect(decideSend({ ...base, conversation: convo({ status: "declined", requestedBy: "a" }) }).allow).toBe(false);
    expect(decideSend({ ...base, conversation: convo({ status: "declined", requestedBy: "b" }) })).toEqual({ allow: true, status: "accepted" });
  });
});

describe("helpers", () => {
  it("orders a pair and finds the other side", () => {
    expect(pairOf("z", "b")).toEqual({ lo: "b", hi: "z" });
    expect(sideOf({ user_lo: "b", user_hi: "z" }, "z")).toEqual({ other: "b" });
    expect(sideOf({ user_lo: "b", user_hi: "z" }, "q")).toBeNull();
  });
  it("makes a one-line preview", () => {
    expect(previewOf("  hello\n\n  there  ")).toBe("hello there");
    expect(previewOf("x".repeat(300))).toHaveLength(140);
  });
});
