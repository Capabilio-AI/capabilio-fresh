import { withChallenges, withCodeQuestions, type Track } from "../types";
import { challenges } from "./challenges";
import { extraChallenges } from "./challenges-extra";
import { codeQuestions } from "./code-questions";
import { basics } from "./m1-basics";
import { control, methods } from "./m2-control-methods";
import { arrays } from "./m3-arrays-strings";
import { oop } from "./m4-oop";
import { exceptions, collections } from "./m5-exceptions-collections";
import { modern, tools } from "./m6-modern-tools";
import { textTools } from "./m7-text";
import { oopDesign } from "./m8-oop-design";
import { genericsCollections } from "./m9-generics";
import { streamsFunctional } from "./m10-streams";
import { algorithms } from "./m11-algorithms";
import { dataStructures } from "./m12-data-structures";
import { concurrency } from "./m13-concurrency";
import { modernFeatures } from "./m14-modern";
import { interviewJava } from "./m15-interview";


export const javaTrack: Track = {
  key: "java",
  title: "Java",
  runnerLanguage: "java",
  tagline: "The language behind most enterprise software and a favourite of placement interviews.",
  outcome: "Write clean object-oriented Java with collections, exceptions, lambdas and streams, and test and debug it, ready for data structures, interviews and real projects.",
  references: [
    { title: "The Java Tutorials (Oracle)", url: "https://docs.oracle.com/javase/tutorial/" },
    { title: "Java SE 21 API documentation", url: "https://docs.oracle.com/en/java/javase/21/docs/api/index.html" },
    { title: "Effective Java (Joshua Bloch)", url: "https://www.oreilly.com/library/view/effective-java/9780134686097/" },
  ],
  modules: withCodeQuestions(withChallenges([basics, control, methods, arrays, oop, exceptions, collections, modern, tools, textTools, oopDesign, genericsCollections, streamsFunctional, algorithms, dataStructures, concurrency, modernFeatures, interviewJava], { ...challenges, ...extraChallenges }), codeQuestions),
};
