import { withChallenges, withCodeQuestions, type Track } from "../types";
import { extraChallenges } from "./challenges-extra";
import { codeQuestions } from "./code-questions";
import { basics, control } from "./m1-basics-control";
import { functions, data } from "./m2-functions-data";
import { oop, tools } from "./m3-oop-tools";
import { textTools } from "./m4-text";
import { iterFunctional } from "./m5-iter-functional";
import { algorithms } from "./m6-algorithms";
import { dataStructures } from "./m7-data-structures";
import { oopAdvanced } from "./m8-oop-advanced";
import { stdlibPractical } from "./m9-stdlib";
import { dataWork } from "./m10-data-work";
import { interviewPython } from "./m11-interview";
import { basicsChallenge, controlChallenge, functionsChallenge, dataChallenge, oopChallenge, toolsChallenge } from "./challenges";

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
  modules: withCodeQuestions([
    { ...basics, challenge: basicsChallenge },
    { ...control, challenge: controlChallenge },
    { ...functions, challenge: functionsChallenge },
    { ...data, challenge: dataChallenge },
    { ...oop, challenge: oopChallenge },
    { ...tools, challenge: toolsChallenge },
    ...withChallenges([textTools, iterFunctional, algorithms, dataStructures, oopAdvanced, stdlibPractical, dataWork, interviewPython], extraChallenges),
  ], codeQuestions),
};
