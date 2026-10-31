import type { ReactNode } from "react";
import "./org-theme.css";
import "./org-workspace.css";

const FONTS =
  "https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800;900&family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&family=Public+Sans:wght@400;500;600;700;800&display=swap";

/** `workspace` = the light staff workspace (/org); `visitor` = the light public college page (/o); neither = the dark public look (other /o pages). */
export function OrgTheme({ children, workspace = false, visitor = false }: { children: ReactNode; workspace?: boolean; visitor?: boolean }) {
  return (
    <div className={visitor ? "org-theme org-ws org-public" : workspace ? "org-theme org-ws" : "org-theme"}>
      {/* React 19 hoists this into <head>; `precedence` lets it dedupe across pages */}
      <link rel="stylesheet" href={FONTS} precedence="default" />
      {children}
    </div>
  );
}
