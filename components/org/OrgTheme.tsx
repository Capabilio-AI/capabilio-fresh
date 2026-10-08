import type { ReactNode } from "react";
import "./org-theme.css";
import "./org-workspace.css";

const FONTS =
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Public+Sans:wght@400;500;600;700;800&display=swap";

/** `workspace` = the light staff workspace (/org); without it, the dark public college page (/o). */
export function OrgTheme({ children, workspace = false }: { children: ReactNode; workspace?: boolean }) {
  return (
    <div className={workspace ? "org-theme org-ws" : "org-theme"}>
      {/* React 19 hoists this into <head>; `precedence` lets it dedupe across pages */}
      <link rel="stylesheet" href={FONTS} precedence="default" />
      {children}
    </div>
  );
}
