import { describe, expect, it } from "vitest";
import { validateTemplate } from "./registry";
import { evaluateRuntimeGate, type RuntimeSetting } from "./gate";

const limits = { memoryMb: 256, wallTimeSeconds: 600 };

describe("validateTemplate", () => {
  it("accepts a valid SQL console config and fills defaults", () => {
    const r = validateTemplate({ runtimeType: "SQL_CONSOLE", config: {}, resourceLimits: limits });
    expect(r).toMatchObject({ ok: true, config: { engine: "sqlite", showSchema: true, maxRows: 500 } });
  });

  it("rejects a config that does not match its runtime", () => {
    const r = validateTemplate({ runtimeType: "CALCULATION_WORKSHEET", config: { inputs: [] }, resourceLimits: null });
    expect(r.ok).toBe(false);
  });

  it("requires resource limits for runtimes that execute user code", () => {
    const r = validateTemplate({ runtimeType: "TERMINAL_VM", config: { image: "debian-broken-nginx" }, resourceLimits: {} });
    expect(r).toEqual({ ok: false, errors: [expect.stringContaining("must declare memoryMb and wallTimeSeconds")] });
  });

  it("does not require limits for a runtime that executes no user code", () => {
    expect(validateTemplate({ runtimeType: "QUESTION_FLOW", config: {}, resourceLimits: null }).ok).toBe(true);
  });

  it("defaults egress to deny and rejects an empty allow-list", () => {
    const ok = validateTemplate({ runtimeType: "TERMINAL_VM", config: { image: "x" }, resourceLimits: limits });
    expect(ok).toMatchObject({ ok: true, resourceLimits: { networkEgress: "deny", egressAllowlist: [] } });
    const bad = validateTemplate({ runtimeType: "TERMINAL_VM", config: { image: "x" }, resourceLimits: { ...limits, networkEgress: "allowlist" } });
    expect(bad.ok).toBe(false);
  });

  it("refuses a simulator whose licence was not verified", () => {
    const base = { simulator: "circuitjs", licenceNote: "GPL-2.0 — terms reviewed" };
    expect(validateTemplate({ runtimeType: "SIMULATOR", config: { ...base, licenceVerified: false }, resourceLimits: null }).ok).toBe(false);
    expect(validateTemplate({ runtimeType: "SIMULATOR", config: { ...base, licenceVerified: true }, resourceLimits: null }).ok).toBe(true);
  });

  it("only allows packages Pyodide ships", () => {
    const r = validateTemplate({ runtimeType: "NOTEBOOK_PYTHON", config: { packages: ["numpy", "left-pad"], evaluationHarness: "h" }, resourceLimits: limits });
    expect(r.ok).toBe(false);
  });
});

describe("evaluateRuntimeGate", () => {
  const setting = (over: Partial<RuntimeSetting> = {}): RuntimeSetting => ({ runtimeType: "SQL_CONSOLE", enabled: true, maxAttemptsPerDay: 3, dailyCostCapCents: 0, attemptCostCents: 0, ...over });

  it("allows an enabled, available runtime under its limits", () => {
    expect(evaluateRuntimeGate(setting(), { attempts: 2, costCents: 0 })).toEqual({ allowed: true });
  });
  it("honours the kill switch", () => {
    expect(evaluateRuntimeGate(setting({ enabled: false }), { attempts: 0, costCents: 0 })).toEqual({ allowed: false, reason: "RUNTIME_DISABLED" });
  });
  it("never starts a runtime that is not built, even if switched on", () => {
    expect(evaluateRuntimeGate(setting({ runtimeType: "TERMINAL_VM" }), { attempts: 0, costCents: 0 })).toEqual({ allowed: false, reason: "RUNTIME_NOT_AVAILABLE" });
  });
  it("enforces the daily attempt limit", () => {
    expect(evaluateRuntimeGate(setting(), { attempts: 3, costCents: 0 })).toEqual({ allowed: false, reason: "DAILY_ATTEMPT_LIMIT" });
  });
  it("enforces the cost cap only when one is set", () => {
    expect(evaluateRuntimeGate(setting(), { attempts: 0, costCents: 999 })).toEqual({ allowed: true });
    expect(evaluateRuntimeGate(setting({ dailyCostCapCents: 50 }), { attempts: 0, costCents: 50 })).toEqual({ allowed: false, reason: "DAILY_COST_LIMIT" });
  });
  it("refuses an attempt that would push spend over the cap, but allows one that fits", () => {
    const capped = setting({ dailyCostCapCents: 100, attemptCostCents: 30 });
    expect(evaluateRuntimeGate(capped, { attempts: 0, costCents: 70 })).toEqual({ allowed: true });
    expect(evaluateRuntimeGate(capped, { attempts: 0, costCents: 71 })).toEqual({ allowed: false, reason: "DAILY_COST_LIMIT" });
  });
  it("treats a missing setting as disabled", () => {
    expect(evaluateRuntimeGate(undefined, { attempts: 0, costCents: 0 })).toEqual({ allowed: false, reason: "RUNTIME_DISABLED" });
  });
});
