import { Atkinson_Hyperlegible, Source_Serif_4 } from "next/font/google";

/** UI face: Atkinson Hyperlegible, chosen for legibility at small sizes. */
export const metroFont = Atkinson_Hyperlegible({ weight: ["400", "700"], subsets: ["latin"], variable: "--font-metro", display: "swap" });
/** Display face: a bold serif, to echo the Capabilio wordmark. */
export const metroDisplay = Source_Serif_4({ weight: ["600", "700"], subsets: ["latin"], variable: "--font-metro-display", display: "swap" });

export const metroFontVars = `${metroFont.variable} ${metroDisplay.variable}`;
