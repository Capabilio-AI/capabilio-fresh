import type { ReactNode } from "react";
import "@/components/metro/metro.css";
import { metroFontVars } from "@/components/metro/font";

/** Gives a page outside the signed-in shell (a public page) the universal palette and fonts. */
export function MetroScope({ children }: { children: ReactNode }) {
  return <div className={`metro ${metroFontVars}`}>{children}</div>;
}
