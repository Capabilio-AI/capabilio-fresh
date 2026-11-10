import type { Track } from "../types";
import { basics, control } from "./m1-basics-control";
import { functions, data } from "./m2-functions-data";
import { oop, tools } from "./m3-oop-tools";

export const pythonTrack: Track = {
  key: "python",
  title: "Python",
  runnerLanguage: "python",
  tagline: "The most readable first language, and the one behind data, AI and automation.",
  outcome: "Write clear Python with functions, data structures, classes, files and tests, ready for data work, scripting and coding interviews.",
  references: [
    { title: "The Python Tutorial (python.org)", url: "https://docs.python.org/3/tutorial/" },
    { title: "Python standard library reference", url: "https://docs.python.org/3/library/" },
    { title: "PEP 8: Style guide for Python code", url: "https://peps.python.org/pep-0008/" },
  ],
  modules: [basics, control, functions, data, oop, tools],
};
