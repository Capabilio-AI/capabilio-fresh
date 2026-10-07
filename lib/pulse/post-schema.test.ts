import { describe, expect, it } from "vitest";
import { PostInputSchema, normalizeTags, readMeta, toRowFields } from "./post-schema";

describe("PostInputSchema", () => {
  it("accepts each kind with its own fields and rejects missing ones", () => {
    expect(PostInputSchema.safeParse({ kind: "post", content: "hello" }).success).toBe(true);
    expect(PostInputSchema.safeParse({ kind: "post", content: "" }).success).toBe(false);
    expect(PostInputSchema.safeParse({ kind: "project", title: "Smart attendance", content: "Face recognition for classrooms." }).success).toBe(true);
    expect(PostInputSchema.safeParse({ kind: "project", content: "no title here, so no" }).success).toBe(false);
    expect(PostInputSchema.safeParse({ kind: "question", title: "How do I index a join in Postgres?" }).success).toBe(true);
    expect(PostInputSchema.safeParse({ kind: "question", title: "short" }).success).toBe(false);
    expect(PostInputSchema.safeParse({ kind: "achievement", title: "AWS Cloud Practitioner" }).success).toBe(true);
  });
  it("refuses fields that belong to another kind, and links that aren't http(s)", () => {
    expect(PostInputSchema.safeParse({ kind: "post", content: "x", stack: ["a"] }).success).toBe(false);
    expect(PostInputSchema.safeParse({ kind: "project", title: "Project", content: "Does a thing well.", repoUrl: "javascript:alert(1)" }).success).toBe(false);
    expect(PostInputSchema.safeParse({ kind: "achievement", title: "Winner", achievedOn: "last week" }).success).toBe(false);
  });
  it("turns a blank optional link into nothing, and cleans tags", () => {
    const r = PostInputSchema.parse({ kind: "project", title: "Project", content: "Does a thing well.", repoUrl: "", stack: ["#React", "react", " Node JS ", "bad tag!!"] });
    expect(r.kind === "project" && r.repoUrl).toBeUndefined();
    expect(r.kind === "project" && r.stack).toEqual(["react", "node-js"]);
  });
});

describe("toRowFields / readMeta", () => {
  it("round-trips a project through its stored form", () => {
    const row = toRowFields(PostInputSchema.parse({ kind: "project", title: "Smart attendance", content: "Face recognition.", stack: ["python", "opencv"], status: "shipped", demoUrl: "https://demo.example.com" }));
    expect(row.kind).toBe("project");
    expect(readMeta("project", row.meta)).toEqual({ kind: "project", title: "Smart attendance", stack: ["python", "opencv"], repoUrl: undefined, demoUrl: "https://demo.example.com", status: "shipped" });
  });
  it("stores a question's title in meta and keeps its details as the body; attachments go in their columns", () => {
    const row = toRowFields(PostInputSchema.parse({ kind: "question", title: "How do I index a join?", tags: ["sql"], attachment: { path: "u/doc/a.pdf", name: "plan.pdf", size: 1234 } }));
    expect(row.content).toBe("");
    expect(row).toMatchObject({ attachment_path: "u/doc/a.pdf", attachment_name: "plan.pdf", attachment_size: 1234 });
    expect(readMeta("question", row.meta)).toMatchObject({ title: "How do I index a join?", tags: ["sql"] });
  });
  it("collects tags from the text and from the structured fields", () => {
    expect(toRowFields(PostInputSchema.parse({ kind: "post", content: "Learning #SQL and #Python today" })).tags).toEqual(["sql", "python"]);
    expect(toRowFields(PostInputSchema.parse({ kind: "project", title: "Project", content: "Built with #react", stack: ["react", "node"] })).tags).toEqual(["react", "node"]);
    expect(toRowFields(PostInputSchema.parse({ kind: "question", title: "How do I index a join in #postgres?", tags: ["sql"] })).tags).toEqual(["postgres", "sql"]);
  });
  it("reads old rows with no meta as plain posts", () => {
    expect(readMeta("project", null)).toBeNull();
    expect(readMeta("post", { title: "x" })).toBeNull();
  });
});

describe("normalizeTags", () => {
  it("lowercases, strips #, hyphenates spaces, de-duplicates and caps", () => {
    expect(normalizeTags(["#SQL", "sql", "Machine Learning", "a b c"], 3)).toEqual(["sql", "machine-learning", "a-b-c"]);
  });
});
