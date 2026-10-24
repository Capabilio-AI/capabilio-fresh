"use client";

import { Component, type ReactNode } from "react";
import { SessionWorkspace } from "./SessionWorkspace";

/** Keeps a failure inside the Proof Session panel from taking the rest of the Domain page down with it. */
class Boundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(error: Error) {
    console.error("[proof-session] panel failed to render", error.message);
  }
  render() {
    if (!this.state.failed) return this.props.children;
    return <p className="mb-6 rounded-xl border border-[var(--m-rule)] bg-white px-5 py-4 font-lp-body text-[13px] text-app-muted">The Proof Session is not available right now. Your daily ticket below still works. Reload to try again.</p>;
  }
}

export function SessionPanel() {
  return (
    <Boundary>
      <SessionWorkspace />
    </Boundary>
  );
}
