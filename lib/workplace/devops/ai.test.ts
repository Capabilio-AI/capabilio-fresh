import { describe, expect, it } from "vitest";
import type { z } from "zod";
import type { GenerationContext } from "@/lib/arena-workstations/types";
import { generateAiDevops, type Deps } from "./ai";

const ctx = (areaKey = "containers"): GenerationContext => ({ roleName: "DevOps Engineer", parentSkill: "DevOps", areaName: areaKey, areaKey, difficulty: "medium", avoidTitles: [], ticketSeed: 4, level: "junior" });

const good = {
  title: "Stop the worker image from running as root",
  requester_name: "Asha Verma", requester_title: "Platform Lead",
  scenario: "Hi, the audit flagged that our worker container runs as root and uses a floating tag. Please tighten the Dockerfile before Friday's release.",
  deliverable: "Edit the Dockerfile so the image is pinned and runs as an unprivileged user.",
  skill_tags: ["Docker", "Security"],
  files: [{ name: "Dockerfile", language: "dockerfile", starter: "FROM python:latest\nCOPY . /app\nCMD [\"python\", \"/app/run.py\"]\n", solution: "FROM python:3.12-slim\nCOPY . /app\nUSER nobody\nCMD [\"python\", \"/app/run.py\"]\n" }],
  checks: [
    { kind: "docker", label: "The base image is pinned to a version, not latest", file: "Dockerfile", instr: "FROM", op: "first_matches", value: "^[\\w./-]+:(?!latest)\\d" },
    { kind: "docker", label: "The container runs as a non-root user", file: "Dockerfile", instr: "USER", op: "last_matches", value: "^(?!root)\\S+" },
    { kind: "docker", label: "The worker still starts with CMD", file: "Dockerfile", instr: "CMD", op: "exists" },
    { kind: "docker", label: "The application files are copied in", file: "Dockerfile", instr: "COPY", op: "exists" },
    { kind: "regex", label: "No secrets are baked in as ENV values", file: "Dockerfile", pattern: "ENV\\s+\\w*(PASSWORD|SECRET)\\w*=", op: "not_matches" },
  ],
};
const solverRight = { files: [{ name: "Dockerfile", content: "FROM python:3.11-slim\nCOPY . /app\nUSER app\nCMD [\"python\", \"/app/run.py\"]\n" }] };

const fake = (gen: unknown, solver: unknown): Deps => {
  let n = 0;
  return { llm: async <T,>(_p: string, _s: string, schema: z.ZodType<T>) => schema.parse(n++ === 0 ? gen : solver) };
};
const reject = (gen: unknown, solver: unknown = solverRight, c = ctx()) => generateAiDevops(c, fake(gen, solver));

describe("AI-written DevOps exercise", () => {
  it("accepts an exercise whose solution passes its checks and which an independent solver can also pass", async () => {
    const d = await reject(good);
    expect(d.content.requirements).toHaveLength(5);
    expect(d.content.files[0].content).toContain("python:latest");
    expect(JSON.stringify(d.content)).not.toContain("3.12-slim");
  });
  it("rejects when the solution fails its own checks", async () => {
    await expect(reject({ ...good, files: [{ ...good.files[0], solution: good.files[0].starter }] })).rejects.toThrow(/fails its own check/);
  });
  it("rejects a starter that already meets the checks", async () => {
    await expect(reject({ ...good, files: [{ ...good.files[0], starter: good.files[0].solution }] })).rejects.toThrow(/already meets/);
  });
  it("rejects when an independent solver cannot satisfy the checks, which means the task is under-explained", async () => {
    await expect(reject(good, { files: [{ name: "Dockerfile", content: "FROM python:3.11-slim\nCOPY . /app\nCMD [\"python\", \"/app/run.py\"]\n" }] })).rejects.toThrow(/independent solver/);
  });
  it("rejects checks on the wrong kind of file, missing files, invalid files and repeated titles", async () => {
    await expect(reject({ ...good, checks: [...good.checks.slice(1), { kind: "yaml", label: "A yaml check on a Dockerfile", file: "Dockerfile", path: "a", op: "exists" }] })).rejects.toThrow(/yaml check was used/);
    await expect(reject({ ...good, checks: [...good.checks.slice(1), { ...good.checks[0], file: "nope" }] })).rejects.toThrow(/missing file/);
    await expect(reject({ ...good, files: [{ ...good.files[0], solution: "COPY . /app\n" }] })).rejects.toThrow(/begin with FROM/);
    await expect(reject(good, solverRight, { ...ctx(), avoidTitles: ["stop the worker image from running as root"] })).rejects.toThrow(/repeats/);
  });
  it("accepts a cloud exercise made of an IAM policy in JSON, and rejects JSON that does not parse", async () => {
    const policy = (action: string) => JSON.stringify({ Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: [action], Resource: ["arn:aws:s3:::reports-prod/*"] }] });
    const cloud = {
      ...good, title: "Give the report job read-only access to one bucket",
      files: [{ name: "policy.json", language: "json", starter: policy("s3:*"), solution: policy("s3:GetObject") }],
      checks: [
        { kind: "yaml", label: "Only the read action s3:GetObject is allowed", file: "policy.json", path: "Statement[*].Action[*]", op: "all_match", value: "^s3:GetObject$" },
        { kind: "yaml", label: "The policy version is 2012-10-17", file: "policy.json", path: "Version", op: "equals", value: "2012-10-17" },
        { kind: "yaml", label: "Access is limited to objects in reports-prod", file: "policy.json", path: "Statement[*].Resource[*]", op: "all_match", value: "^arn:aws:s3:::reports-prod/\\*$" },
        { kind: "yaml", label: "The statement is an Allow", file: "policy.json", path: "Statement[*].Effect", op: "equals", value: "Allow" },
        { kind: "yaml", label: "There is at least one statement", file: "policy.json", path: "Statement", op: "count_gte", value: 1 },
        { kind: "yaml", label: "Wildcard actions are gone", file: "policy.json", path: "Statement[*].Action[*]", op: "matches", value: "^s3:GetObject$" },
      ],
    };
    const solver = { files: [{ name: "policy.json", content: policy("s3:GetObject") }] };
    const d = await generateAiDevops({ ...ctx("iam-security"), roleName: "Cloud Engineer" }, fake(cloud, solver));
    expect(d.content.files[0].language).toBe("json");
    await expect(generateAiDevops(ctx("iam-security"), fake({ ...cloud, files: [{ ...cloud.files[0], solution: "{not json" }] }, solver))).rejects.toThrow(/does not parse/);
  });
  it("rejects a regex that could run away", async () => {
    await expect(reject({ ...good, checks: [...good.checks.slice(1), { kind: "regex", label: "A risky pattern", file: "Dockerfile", pattern: "(a+)+b", op: "matches" }] })).rejects.toThrow();
  });
});
