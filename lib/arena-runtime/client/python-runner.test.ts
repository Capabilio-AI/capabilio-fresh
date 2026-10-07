import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PythonRunner } from "./python-runner";

type Listener = (e: MessageEvent) => void;
class FakeWorker {
  static instances: FakeWorker[] = [];
  listeners = new Set<Listener>();
  sent: Record<string, unknown>[] = [];
  terminated = false;
  /** how the fake answers: a function returning the reply for a message, or null to never answer (a stuck cell) */
  static respond: (m: Record<string, unknown>) => Record<string, unknown> | null = (m) => ({ id: m.id, ok: true });
  constructor() {
    FakeWorker.instances.push(this);
  }
  addEventListener(_t: string, l: Listener) {
    this.listeners.add(l);
  }
  removeEventListener(_t: string, l: Listener) {
    this.listeners.delete(l);
  }
  postMessage(m: Record<string, unknown>) {
    this.sent.push(m);
    const reply = FakeWorker.respond(m);
    if (reply) queueMicrotask(() => this.listeners.forEach((l) => l({ data: reply } as MessageEvent)));
  }
  terminate() {
    this.terminated = true;
  }
}

beforeEach(() => {
  FakeWorker.instances = [];
  FakeWorker.respond = (m) => ({ id: m.id, ok: true });
  vi.stubGlobal("Worker", FakeWorker);
  vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:fake");
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("PythonRunner resource limits", () => {
  it("mounts the packages and files when it starts", async () => {
    const r = new PythonRunner(["numpy"], [{ name: "a.csv", text: "x" }], 5000);
    await r.start();
    expect(FakeWorker.instances[0].sent[0]).toMatchObject({ type: "init", packages: ["numpy"], files: [{ name: "a.csv", text: "x" }] });
    expect(r.isRunning).toBe(true);
  });

  it("kills a cell that never returns, and can be started again", async () => {
    const r = new PythonRunner([], [], 5000);
    await r.start();
    FakeWorker.respond = () => null; // a `while True:` cell
    const run = r.run("while True: pass");
    const settled = run.catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(5001);
    expect(await settled).toMatch(/longer than 5s and was stopped/);
    expect(FakeWorker.instances[0].terminated).toBe(true);
    expect(r.isRunning).toBe(false);

    FakeWorker.respond = (m) => ({ id: m.id, ok: true });
    await r.start();
    expect(r.isRunning).toBe(true);
    expect(FakeWorker.instances).toHaveLength(2);
  });

  it("returns a cell's output and error as data", async () => {
    const r = new PythonRunner([], [], 5000);
    await r.start();
    FakeWorker.respond = (m) => ({ id: m.id, ok: true, stdout: "42", error: null });
    expect(await r.run("print(42)")).toMatchObject({ stdout: "42", error: null });
  });

  it("only reads variables with a safe name", async () => {
    const r = new PythonRunner([], [], 5000);
    await r.start();
    const before = FakeWorker.instances[0].sent.length;
    expect(await r.value("x; import os")).toBeNull();
    expect(FakeWorker.instances[0].sent).toHaveLength(before);
  });

  it("stop() terminates the worker", async () => {
    const r = new PythonRunner([], [], 5000);
    await r.start();
    r.stop();
    expect(FakeWorker.instances[0].terminated).toBe(true);
  });
});
