import { describe, expect, it } from "vitest";
import { cTrack } from "@/lib/languages/c";
import { pythonTrack } from "@/lib/languages/python";
import { javascriptTrack } from "@/lib/languages/javascript";
import { cppTrack } from "@/lib/languages/cpp";
import { hasWord, recommendedTracks, searchLanguages, searchRoles, searchWords, topicTrack, STAGES, type RoleRow } from "./find";

const tracks = [cTrack, pythonTrack, javascriptTrack, cppTrack];

describe("searchWords", () => {
  it("keeps what matters and drops filler", () => {
    expect(searchWords("I want to learn Embedded Systems")).toEqual(["embedded", "systems"]);
    expect(searchWords("  the basics of POINTERS!! ")).toEqual(["pointers"]);
  });
  it("keeps c++ and c# whole, removes repeats, and never returns more than 8", () => {
    expect(searchWords("C++ and c# and C++")).toEqual(["c++", "c#"]);
    expect(searchWords("a1 b2 c3 d4 e5 f6 g7 h8 i9 j10")).toHaveLength(8);
    expect(searchWords("")).toEqual([]);
  });
});

describe("hasWord", () => {
  it("matches whole words only", () => {
    expect(hasWord("C Programming", "c")).toBe(true);
    expect(hasWord("Debugging and tools", "c")).toBe(false);
    expect(hasWord("Learn C++ today", "c")).toBe(false);
    expect(hasWord("Learn C++ today", "c++")).toBe(true);
    expect(hasWord("Pointers and arrays", "pointer")).toBe(false);
  });
});

describe("recommendedTracks", () => {
  it("maps everyday words to a course with a plain reason, in order, without repeats", () => {
    const r = recommendedTracks(["embedded", "firmware", "web"]);
    expect(r.map((x) => x.track)).toEqual(["c", "html", "javascript"]);
    expect(r[0].why).toBe("Embedded devices are programmed in C.");
  });
  it("gives nothing for a word we have no hint for", () => {
    expect(recommendedTracks(["welding"])).toEqual([]);
  });
});

describe("topicTrack", () => {
  it("opens the course we have for a roadmap topic", () => {
    expect(topicTrack("C Programming")).toBe("c");
    expect(topicTrack("Programming Fundamentals")).toBe("c");
    expect(topicTrack("Python for Data Analysis")).toBe("python");
    expect(topicTrack("JavaScript Basics")).toBe("javascript");
    expect(topicTrack("Java Collections")).toBe("java");
    expect(topicTrack("SQL and Databases")).toBe("sql");
    expect(topicTrack("C++ Templates")).toBe("cpp");
  });
  it("says null when there is no course for the topic yet", () => {
    for (const t of ["Operating Systems", "Interrupts and Timers", "Communication Protocols (I2C, SPI, UART)", "Computer Networks"]) expect(topicTrack(t)).toBeNull();
  });
});

describe("searchLanguages", () => {
  it("finds a lesson by what it teaches", () => {
    const hits = searchLanguages(["pointers"], tracks);
    expect(hits.length).toBeGreaterThan(0);
    expect(hits[0].track).toBe("c");
    expect(hits[0].href.startsWith("/skillstudio/courses/c/")).toBe(true);
  });
  it("puts a course whose own name matches first", () => {
    expect(searchLanguages(["python"], tracks)[0]).toMatchObject({ kind: "course", track: "python", href: "/skillstudio/courses/python" });
  });
  it("returns nothing for no words or for something we do not teach", () => {
    expect(searchLanguages([], tracks)).toEqual([]);
    expect(searchLanguages(["welding"], tracks)).toEqual([]);
  });
  it("never returns more than the limit", () => {
    expect(searchLanguages(["the", "function", "loop", "array", "string"], tracks, 3).length).toBeLessThanOrEqual(3);
  });
});

describe("searchRoles", () => {
  const roles: RoleRow[] = [
    { key: "embedded-systems-engineer", name: "Embedded Systems Engineer", category: "AI generated", description: "Builds software for devices.", topics: [{ title: "C Programming", stage: "FOUNDATION" }, { title: "Embedded Linux", stage: "SPECIALIZATION" }, { title: "RTOS", stage: "SPECIALIZATION" }] },
    { key: "data-analyst", name: "Data Analyst", category: "Data", description: "Finds answers in data.", topics: [{ title: "SQL", stage: "FOUNDATION" }, { title: "Statistics", stage: "CORE" }] },
    { key: "civil-engineer", name: "Civil Engineer", category: "Civil", description: null, topics: [{ title: "Surveying", stage: "FOUNDATION" }] },
  ];
  it("ranks the role whose name matches first, and lists the topics that matched", () => {
    const hits = searchRoles(["embedded"], roles);
    expect(hits.map((h) => h.key)).toEqual(["embedded-systems-engineer"]);
    expect(hits[0].matched).toEqual(["Embedded Linux"]);
    expect(hits[0].topicCount).toBe(3);
  });
  it("finds a role by one of its topics", () => {
    expect(searchRoles(["sql"], roles).map((h) => h.key)).toEqual(["data-analyst"]);
  });
  it("finds nothing for words no role has", () => {
    expect(searchRoles(["welding"], roles)).toEqual([]);
    expect(searchRoles([], roles)).toEqual([]);
  });
});

describe("STAGES", () => {
  it("lists the four stages in order, with plain titles", () => {
    expect(STAGES.map((s) => s.key)).toEqual(["FOUNDATION", "CORE", "SPECIALIZATION", "JOB_READY"]);
    expect(STAGES.map((s) => s.title)).toEqual(["Start here", "Main skills", "Go deeper", "Get job ready"]);
  });
});
