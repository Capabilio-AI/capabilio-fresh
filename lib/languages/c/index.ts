import { withChallenges, withCodeQuestions, type Track } from "../types";
import { challenges as baseChallenges } from "./challenges";
import { extraChallenges } from "./challenges-extra";
import { codeQuestions } from "./code-questions";
import { basics } from "./m1-basics";
import { control } from "./m2-control";
import { functions } from "./m3-functions";
import { arrays } from "./m4-arrays";
import { strings } from "./m5-strings";
import { pointers } from "./m6-pointers";
import { memory } from "./m7-memory";
import { structs } from "./m8-structs";
import { files } from "./m9-files";
import { advanced } from "./m10-advanced";
import { typesDeep } from "./m11-types";
import { recursionAlgos } from "./m12-recursion";
import { library } from "./m13-library";
import { stackQueue } from "./m14-stack-queue";
import { listsDeeper } from "./m15-lists";
import { treesHash } from "./m16-trees-hash";
import { bitsEmbedded } from "./m17-bits-embedded";
import { projectSkills } from "./m18-projects";
import { interview } from "./m19-interview";

const challenges = { ...baseChallenges, ...extraChallenges };

export const cTrack: Track = {
  key: "c",
  title: "C Programming",
  runnerLanguage: "c",
  tagline: "The language that shows you how a computer really works.",
  outcome: "Write, compile and debug C programs with arrays, strings, pointers, dynamic memory, structures and files, ready for data structures and placement coding rounds.",
  references: [
    { title: "The C Programming Language (Kernighan and Ritchie)", url: "https://en.wikipedia.org/wiki/The_C_Programming_Language" },
    { title: "cppreference: C language reference", url: "https://en.cppreference.com/w/c" },
    { title: "GNU C Library manual", url: "https://www.gnu.org/software/libc/manual/html_node/index.html" },
  ],
  modules: withCodeQuestions(withChallenges([basics, control, functions, arrays, strings, pointers, memory, structs, files, advanced, typesDeep, recursionAlgos, library, stackQueue, listsDeeper, treesHash, bitsEmbedded, projectSkills, interview], challenges), codeQuestions),
};
