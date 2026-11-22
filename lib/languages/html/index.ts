import { withChallenges, type Track } from "../types";
import { challenges } from "./challenges";
import { htmlBasics, htmlForms } from "./m1-html";
import { cssBasics, cssLayout } from "./m2-css";

export const htmlTrack: Track = {
  key: "html",
  title: "HTML & CSS",
  runnerLanguage: "html",
  tagline: "The foundation of every website: structure it with HTML, style it with CSS.",
  outcome: "Build accessible, responsive pages with semantic HTML, forms, Flexbox and Grid, ready for front-end work and for learning JavaScript.",
  references: [
    { title: "MDN: Learn web development", url: "https://developer.mozilla.org/en-US/docs/Learn_web_development" },
    { title: "MDN: HTML reference", url: "https://developer.mozilla.org/en-US/docs/Web/HTML" },
    { title: "MDN: CSS reference", url: "https://developer.mozilla.org/en-US/docs/Web/CSS" },
  ],
  modules: withChallenges([htmlBasics, htmlForms, cssBasics, cssLayout], challenges),
};
