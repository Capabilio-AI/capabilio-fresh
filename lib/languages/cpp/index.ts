import { withChallenges, withCodeQuestions, type Track } from "../types";
import { challenges as baseChallenges } from "./challenges";
import { extraChallenges } from "./challenges-extra";
import { codeQuestions } from "./code-questions";
import { containers } from "./m5-containers";
import { stlAlgorithms } from "./m6-stl-algorithms";
import { memoryDeep } from "./m7-memory-deep";
import { oopAdvanced } from "./m8-oop-advanced";
import { templatesModule } from "./m9-templates";
import { dataStructures } from "./m10-data-structures";
import { interviewCpp } from "./m13-interview";
import { basics, functions } from "./m1-basics-functions";
import { stl, memory } from "./m2-stl-memory";
import { oop, practice } from "./m3-oop-practice";

const challenges = { ...baseChallenges, ...extraChallenges };

export const cppTrack: Track = {
  key: "cpp",
  title: "C++",
  runnerLanguage: "cpp",
  tagline: "Fast, powerful and the first choice for competitive programming and systems work.",
  outcome: "Write modern C++20 with the STL, references, classes, smart pointers and templates, ready for DSA, contests and placement coding rounds.",
  references: [
    { title: "cppreference: C++ reference", url: "https://en.cppreference.com/w/cpp" },
    { title: "C++ Core Guidelines", url: "https://isocpp.github.io/CppCoreGuidelines/CppCoreGuidelines" },
    { title: "A Tour of C++ (Bjarne Stroustrup)", url: "https://www.stroustrup.com/tour3.html" },
  ],
  modules: withCodeQuestions(withChallenges([basics, functions, stl, memory, oop, practice, containers, stlAlgorithms, memoryDeep, oopAdvanced, templatesModule, dataStructures, interviewCpp], challenges), codeQuestions),
};
