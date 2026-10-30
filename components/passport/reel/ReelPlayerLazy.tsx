"use client";

import dynamic from "next/dynamic";

// Remotion's player is heavy and browser-only, so it loads only where a reel is actually shown.
export const ReelPlayerLazy = dynamic(() => import("./ReelPlayer").then((m) => m.ReelPlayer), { ssr: false });
