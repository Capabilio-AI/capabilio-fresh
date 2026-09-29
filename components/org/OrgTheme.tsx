import type { ReactNode } from "react";
import "./org-theme.css";

const FONTS =
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap";

/** Dark "Institution OS" surface shared by the workspace (/org) and the public college page (/o). */
export function OrgTheme({ children }: { children: ReactNode }) {
  return (
    <div className="org-theme">
      {/* React 19 hoists this into <head>; `precedence` lets it dedupe across pages */}
      <link rel="stylesheet" href={FONTS} precedence="default" />
      {children}
    </div>
  );
}
