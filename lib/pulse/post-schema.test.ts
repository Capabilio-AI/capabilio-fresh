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

describe("networking post kinds", () => {
  it("an opportunity needs a title and cleans its skills and apply link", () => {
    expect(PostInputSchema.safeParse({ kind: "opportunity", content: "no title" }).success).toBe(false);
    const r = PostInputSchema.parse({ kind: "opportunity", title: "Frontend intern", opportunityType: "internship", company: "Acme", applyUrl: "", skills: ["#React", "react", "Type Script"] });
    expect(r.kind === "opportunity" && r.applyUrl).toBeUndefined();
    expect(r.kind === "opportunity" && r.skills).toEqual(["react", "type-script"]);
    expect(PostInputSchema.safeParse({ kind: "opportunity", title: "Frontend intern", applyUrl: "javascript:alert(1)" }).success).toBe(false);
  });
  it("a resource must carry a real http(s) link", () => {
    expect(PostInputSchema.safeParse({ kind: "resource", title: "Great SQL guide" }).success).toBe(false);
    expect(PostInputSchema.safeParse({ kind: "resource", title: "Great SQL guide", url: "javascript:alert(1)" }).success).toBe(false);
    expect(PostInputSchema.safeParse({ kind: "resource", title: "Great SQL guide", url: "https://example.com/sql" }).success).toBe(true);
  });
  it("round-trips through their stored form and feeds trending tags", () => {
    const row = toRowFields(PostInputSchema.parse({ kind: "opportunity", title: "Data analyst referral", company: "Acme", skills: ["sql"], content: "Happy to refer #data folks" }));
    expect(row.kind).toBe("opportunity");
    expect(readMeta("opportunity", row.meta)).toMatchObject({ kind: "opportunity", title: "Data analyst referral", opportunityType: "job", company: "Acme", skills: ["sql"] });
    expect(row.tags).toEqual(expect.arrayContaining(["sql", "data"]));
    const res = toRowFields(PostInputSchema.parse({ kind: "resource", title: "SQL guide", url: "https://example.com/sql", tags: ["sql"] }));
    expect(readMeta("resource", res.meta)).toEqual({ kind: "resource", title: "SQL guide", url: "https://example.com/sql", tags: ["sql"] });
  });
});
