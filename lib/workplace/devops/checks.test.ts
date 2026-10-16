import { describe, expect, it } from "vitest";
import { parseDockerfile, runChecks, valuesAt, type Check } from "./checks";

describe("config checks", () => {
  it("reads values at a path, with wildcards and indexes", () => {
    const doc = { jobs: { build: { steps: [{ uses: "actions/checkout@v4" }, { run: "npm ci" }, { uses: "actions/setup-node@v4" }] } }, spec: { containers: [{ image: "a" }, { image: "b" }] } };
    expect(valuesAt(doc, "jobs.build.steps[*].uses")).toEqual(["actions/checkout@v4", "actions/setup-node@v4"]);
    expect(valuesAt(doc, "spec.containers[1].image")).toEqual(["b"]);
    expect(valuesAt(doc, "jobs.test")).toEqual([]);
    const template = { Resources: { Logs: { Type: "AWS::S3::Bucket", Properties: { Versioning: "on" } }, Fn: { Type: "AWS::Lambda::Function" } } };
    expect(valuesAt(template, "Resources.*.Type")).toEqual(["AWS::S3::Bucket", "AWS::Lambda::Function"]);
    expect(valuesAt(template, "Resources.*.Properties.Versioning")).toEqual(["on"]);
  });

  it("reads CloudFormation with its short-form tags and JSON policies through the same checks", () => {
    const cfn = { name: "t.yml", content: "Resources:\n  Fn:\n    Type: AWS::Lambda::Function\n    Properties:\n      Role: !GetAtt FnRole.Arn\n      Timeout: 15\n" };
    const policy = { name: "p.json", content: JSON.stringify({ Version: "2012-10-17", Statement: [{ Effect: "Allow", Action: ["s3:GetObject"], Resource: "arn:aws:s3:::logs/*" }] }) };
    const out = runChecks([cfn, policy], [
      { kind: "yaml", label: "the function has a timeout", file: "t.yml", path: "Resources.*.Properties.Timeout", op: "equals", value: 15 },
      { kind: "yaml", label: "no wildcard actions", file: "p.json", path: "Statement[*].Action[*]", op: "all_match", value: "^s3:Get" },
      { kind: "yaml", label: "no star resource", file: "p.json", path: "Statement[*].Resource", op: "not_exists" },
    ]);
    expect(out.map((r) => r.passed)).toEqual([true, true, false]);
  });

  it("joins Dockerfile continuations and ignores comments", () => {
    expect(parseDockerfile("# base\nFROM node:20\nRUN apt-get update \\\n  && apt-get install -y curl\nUSER app\n")).toEqual([{ instr: "FROM", args: "node:20" }, { instr: "RUN", args: "apt-get update && apt-get install -y curl" }, { instr: "USER", args: "app" }]);
  });

  it("checks yaml, Dockerfile and raw text", () => {
    const files = [
      { name: "ci.yml", content: "on: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm test\n" },
      { name: "Dockerfile", content: "FROM node:20-alpine\nCOPY package.json .\nRUN npm ci\nCOPY . .\nUSER node\n" },
      { name: "nginx.conf", content: "server { listen 80; gzip on; }" },
    ];
    const checks: Check[] = [
      { kind: "yaml", label: "runs on push", file: "ci.yml", path: "on", op: "equals", value: "push" },
      { kind: "yaml", label: "has a test step", file: "ci.yml", path: "jobs.test.steps[*].run", op: "contains", value: "npm test" },
      { kind: "yaml", label: "no deploy job", file: "ci.yml", path: "jobs.deploy", op: "not_exists" },
      { kind: "docker", label: "pinned base image", file: "Dockerfile", instr: "FROM", op: "first_matches", value: "^node:\\d+" },
      { kind: "docker", label: "not root", file: "Dockerfile", instr: "USER", op: "last_matches", value: "^(?!root)" },
      { kind: "docker", label: "deps before source", file: "Dockerfile", instr: "RUN", op: "before", value: "npm ci", other: "COPY \\. \\." },
      { kind: "regex", label: "gzip on", file: "nginx.conf", pattern: "gzip\\s+on", op: "matches" },
      { kind: "regex", label: "no server tokens", file: "nginx.conf", pattern: "server_tokens\\s+on", op: "not_matches" },
      { kind: "yaml", label: "missing file", file: "other.yml", path: "a", op: "exists" },
    ];
    expect(runChecks(files, checks).map((r) => r.passed)).toEqual([true, true, true, true, true, true, true, true, false]);
  });

  it("treats broken YAML as failing, not crashing, and rejects risky patterns", () => {
    expect(runChecks([{ name: "a.yml", content: "a: [unclosed" }], [{ kind: "yaml", label: "reads the file ok", file: "a.yml", path: "a", op: "exists" }])[0].passed).toBe(false);
    expect(() => runChecks([], [{ kind: "regex", label: "checks something here", file: "x", pattern: "(a+)+", op: "matches" } as Check])).not.toThrow();
  });
});
