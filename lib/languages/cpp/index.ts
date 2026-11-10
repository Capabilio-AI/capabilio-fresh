import type { Track } from "../types";
import { basics, functions } from "./m1-basics-functions";
import { stl, memory } from "./m2-stl-memory";
import { oop, practice } from "./m3-oop-practice";

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
  modules: [basics, functions, stl, memory, oop, practice],
};
