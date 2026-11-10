import type { Track } from "../types";
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
  modules: [basics, control, functions, arrays, strings, pointers, memory, structs, files, advanced],
};
