import { describe, expect, it } from "vitest";
import { selectSignificantRepositories, scoreRepository } from "./github-repository-selection";
import type { GithubRepoListItem } from "./github-scan";

function repo(overrides: Partial<GithubRepoListItem>): GithubRepoListItem {
  return {
    name: "repo",
    full_name: "user/repo",
    html_url: "https://github.com/user/repo",
    description: null,
    fork: false,
    stargazers_count: 0,
    forks_count: 0,
    archived: false,
    size: 100,
    language: "TypeScript",
    topics: [],
    license: null,
    created_at: "2025-01-01T00:00:00Z",
    updated_at: "2026-09-01T00:00:00Z",
    ...overrides,
  };
}

describe("selectSignificantRepositories", () => {
  it("never ranks by stars alone: a heavily-starred fork loses to a real, recent original repo", () => {
    const starredFork = repo({ name: "starred-fork", fork: true, stargazers_count: 5000, updated_at: "2020-01-01T00:00:00Z" });
    const realWork = repo({ name: "real-work", fork: false, stargazers_count: 2, updated_at: new Date().toISOString() });
    const [first] = selectSignificantRepositories([starredFork, realWork], 2);
    expect(first.name).toBe("real-work");
  });

  it("caps the star contribution rather than letting it dominate", () => {
    const fewStars = repo({ stargazers_count: 11 });
    const manyStars = repo({ stargazers_count: 50000 });
    expect(scoreRepository(manyStars)).toBe(scoreRepository(fewStars));
  });

  it("respects the explicit limit", () => {
    const repos = Array.from({ length: 10 }, (_, i) => repo({ name: `repo-${i}` }));
    expect(selectSignificantRepositories(repos, 3)).toHaveLength(3);
  });

  it("prefers recently-updated repos over stale ones", () => {
    const stale = repo({ name: "stale", updated_at: "2018-01-01T00:00:00Z" });
    const fresh = repo({ name: "fresh", updated_at: new Date().toISOString() });
    expect(selectSignificantRepositories([stale, fresh], 1)[0].name).toBe("fresh");
  });
});
