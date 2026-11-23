import { withChallenges, type Track } from "../types";
import { challenges } from "./challenges";
import { browserChallenge } from "./browser-challenge";
import { jsBasics, jsFunctions, jsData } from "./m1-basics";
import { jsModern, jsBrowser } from "./m2-async-browser";

export const javascriptTrack: Track = {
  key: "javascript",
  title: "JavaScript",
  runnerLanguage: "javascript",
  tagline: "The language of the web, and of most front-end and Node.js jobs.",
  outcome: "Write modern JavaScript with functions, arrays, objects, classes and async code, then use it in the browser to build interactive pages.",
  references: [
    { title: "MDN: JavaScript Guide", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide" },
    { title: "javascript.info: The Modern JavaScript Tutorial", url: "https://javascript.info/" },
    { title: "MDN: JavaScript reference", url: "https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference" },
  ],
  modules: withChallenges([jsBasics, jsFunctions, jsData, jsModern, jsBrowser], { ...challenges, "js-browser": browserChallenge }),
};
