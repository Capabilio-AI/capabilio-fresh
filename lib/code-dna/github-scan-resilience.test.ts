import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fetchWithBackoff, lastPageFromLinkHeader, scanGithubProfileFull, scanOneRepository, type GithubRepoListItem } from "./github-scan";

function repoListItem(overrides: Partial<GithubRepoListItem> = {}): GithubRepoListItem {
  return {
    name: "repo",
    full_name: "student/repo",
    html_url: "https://github.com/student/repo",
    description: null,
    fork: false,
    stargazers_count: 0,
    forks_count: 0,
    archived: false,
    size: 10,
    language: "TypeScript",
    topics: [],
    license: null,
    created_at: "2024-01-01T00:00:00Z",
    updated_at: "2024-06-01T00:00:00Z",
    ...overrides,
  } as GithubRepoListItem;
}

function jsonResponse(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}) {
  return new Response(JSON.stringify(body), {
    status: init.status ?? 200,
    headers: { "content-type": "application/json", ...init.headers },
  });
}

describe("lastPageFromLinkHeader", () => {
  it("reads the last page number for exact-count pagination", () => {
    const header = '<https://api.github.com/x?page=1>; rel="first", <https://api.github.com/x?page=7>; rel="last"';
    expect(lastPageFromLinkHeader(header)).toBe(7);
  });

  it("returns null when there is no Link header (single page, no more results)", () => {
    expect(lastPageFromLinkHeader(null)).toBeNull();
  });
});

describe("fetchWithBackoff", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries a rate-limited (403, remaining=0) response and returns the eventual success", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(jsonResponse({}, { status: 403, headers: { "x-ratelimit-remaining": "0" } }))
      .mockResolvedValueOnce(jsonResponse({ ok: true }));
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = fetchWithBackoff("https://api.github.com/users/student");
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("gives up after the bounded number of attempts rather than retrying forever", async () => {
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse({}, { status: 403, headers: { "x-ratelimit-remaining": "0" } }));
    vi.stubGlobal("fetch", fetchMock);

    const resultPromise = fetchWithBackoff("https://api.github.com/users/student");
    await vi.runAllTimersAsync();
    const result = await resultPromise;

    expect(result.status).toBe(403);
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("scanOneRepository — one repository's failure never fails the whole scan", () => {
  afterEach(() => vi.restoreAllMocks());

  it("marks a repo as failed (deleted/renamed/private/timeout) instead of throwing", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network timeout")));

    const result = await scanOneRepository("student", repoListItem());

    expect(result.scanStatus).toBe("failed");
    expect(result.scanError).toContain("timeout");
    // Repo identity is still preserved so the UI can show a per-repo notice.
    expect(result.name).toBe("repo");
  });

  it("degrades gracefully (empty evidence, not a crash) when sub-requests 404", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("not found", { status: 404 })));

    const result = await scanOneRepository("student", repoListItem());

    expect(result.scanStatus).toBe("ok");
    expect(result.techSignals).toEqual([]);
    expect(result.candidateCommitCount).toBe(0);
  });

  it("still counts the candidate's real commits on a fork, instead of hardcoding 0", async () => {
    // Regression: a fork can carry substantial original work (e.g. building
    // on a starter template) — the scan must not zero out commit evidence
    // just because is_fork is true. The fork itself is still disclosed
    // separately via forkSourceFullName.
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        if (url.includes("/commits?author=")) {
          return Promise.resolve(jsonResponse([{ commit: { author: { date: "2026-01-01T00:00:00Z" } } }]));
        }
        if (url.includes("/commits?per_page=")) {
          return Promise.resolve(
            jsonResponse([{ author: { login: "student" }, commit: { author: { date: "2026-01-01T00:00:00Z" } } }])
          );
        }
        // contributors/languages/repo-detail/root-contents all tolerate an
        // empty array or object response without throwing.
        return Promise.resolve(jsonResponse([]));
      })
    );

    const result = await scanOneRepository("student", repoListItem({ fork: true }));

    expect(result.isFork).toBe(true);
    expect(result.candidateCommitCount).toBeGreaterThan(0);
  });
});

describe("scanGithubProfileFull — partial coverage", () => {
  afterEach(() => vi.restoreAllMocks());

  it("still returns the repos that scanned fine when the profile fetch itself fails other calls", async () => {
    let call = 0;
    vi.stubGlobal(
      "fetch",
      vi.fn().mockImplementation((url: string) => {
        call += 1;
        if (url.includes("/users/student") && !url.includes("/repos")) {
          return Promise.resolve(jsonResponse({ login: "student", bio: null, public_repos: 1, html_url: "https://github.com/student" }));
        }
        if (url.includes("/users/student/repos")) {
          return Promise.resolve(jsonResponse([repoListItem(), repoListItem({ name: "other", full_name: "student/other" })]));
        }
        // Every per-repo detail/commit/PR/contents call fails for the second repo only.
        if (url.includes("student/other")) return Promise.reject(new Error("deleted"));
        return Promise.resolve(jsonResponse([]));
      })
    );

    const result = await scanGithubProfileFull("student", (repos) => repos);

    expect(result.repositories).toHaveLength(2);
    const [ok, failed] = result.repositories;
    expect(ok.scanStatus).toBe("ok");
    expect(failed.scanStatus).toBe("failed");
    expect(call).toBeGreaterThan(0);
  });
});
