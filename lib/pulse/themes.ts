/** Backgrounds for text stories. The index is what the database stores (stories.theme 0-7). */
export const STORY_THEMES = [
  { from: "#f26b2b", to: "#f7a13a", ink: "#ffffff" },
  { from: "#1f2937", to: "#4b5563", ink: "#ffffff" },
  { from: "#2f5de0", to: "#6f8cf5", ink: "#ffffff" },
  { from: "#0f7b6c", to: "#34b39a", ink: "#ffffff" },
  { from: "#8b3fd1", to: "#c27ae8", ink: "#ffffff" },
  { from: "#c2255c", to: "#ef6f95", ink: "#ffffff" },
  { from: "#f6e7c8", to: "#f2c98a", ink: "#2a2118" },
  { from: "#0b132b", to: "#1c2a5c", ink: "#ffffff" },
] as const;

export const themeBackground = (i: number): string => {
  const t = STORY_THEMES[i] ?? STORY_THEMES[0];
  return `linear-gradient(145deg, ${t.from}, ${t.to})`;
};
export const themeInk = (i: number): string => (STORY_THEMES[i] ?? STORY_THEMES[0]).ink;
