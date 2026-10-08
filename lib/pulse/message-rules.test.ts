import { describe, expect, it } from "vitest";
import { decideSend, pairOf, previewOf, sideOf, type ConversationState } from "./message-rules";

const base = { me: "a", blocked: false };
const convo = (over: Partial<ConversationState>): ConversationState => ({ status: "accepted", requestedBy: "a", ...over });

describe("decideSend", () => {
  it("a first message to anyone is delivered straight to their inbox", () => {
    expect(decideSend({ ...base, conversation: null })).toEqual({ allow: true, status: "accepted" });
  });
  it("never when blocked, whatever the state", () => {
    expect(decideSend({ ...base, blocked: true, conversation: null }).allow).toBe(false);
    expect(decideSend({ ...base, blocked: true, conversation: convo({}) }).allow).toBe(false);
  });
  it("an accepted conversation is open both ways", () => {
    expect(decideSend({ ...base, conversation: convo({}) })).toEqual({ allow: true, status: "accepted" });
    expect(decideSend({ ...base, conversation: convo({ requestedBy: "b" }) })).toEqual({ allow: true, status: "accepted" });
  });
  it("an older pending request opens up when either side writes", () => {
    expect(decideSend({ ...base, conversation: convo({ status: "pending", requestedBy: "a" }) })).toEqual({ allow: true, status: "accepted" });
    expect(decideSend({ ...base, conversation: convo({ status: "pending", requestedBy: "b" }) })).toEqual({ allow: true, status: "accepted" });
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
