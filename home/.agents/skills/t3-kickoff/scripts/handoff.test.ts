import { describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { callingThread, handoffPrompt, matchProjects, modelFlags, projectRepository, remoteCommand, repositoryKey } from "./handoff.ts";

const fleet = {
  id: "project-fleet",
  title: "fleet",
  workspaceRoot: "/home/coder/dev/fleet",
  repositoryIdentity: { canonicalKey: "github.com/silthus/fleet", locator: { remoteUrl: "git@github.com:Silthus/fleet.git" } },
};
const posthog = { id: "project-posthog", title: "posthog", workspaceRoot: "/home/coder/dev/posthog", repositoryIdentity: null };

const thread = (id: string, worktreePath: string | null, state: string, projectId = fleet.id) => ({
  id,
  title: `Thread ${id}`,
  projectId,
  worktreePath,
  modelSelection: { instanceId: "claudeAgent", model: "claude-opus-5-5" },
  archivedAt: null,
  status: state,
});

describe("matchProjects", () => {
  test("finds a project by id, title, or repository", () => {
    for (const key of ["project-fleet", "fleet", "github.com/silthus/fleet"]) {
      expect(matchProjects([fleet, posthog], key)).toEqual([fleet]);
    }
  });

  test("finds nothing for an unknown repository", () => {
    expect(matchProjects([fleet, posthog], "github.com/silthus/kudos")).toEqual([]);
  });

  test("finds a project without a repository identity by its origin remote", () => {
    const unidentified = { ...fleet, repositoryIdentity: null };
    const originUrl = (root: string) => (root === fleet.workspaceRoot ? "git@github.com:Silthus/fleet.git" : undefined);
    expect(matchProjects([unidentified, posthog], "github.com/Silthus/fleet", originUrl)).toEqual([unidentified]);
  });

  test("finds a fork whose identity names the upstream by its origin remote", () => {
    const fork = { ...fleet, repositoryIdentity: { canonicalKey: "github.com/upstream/fleet" } };
    const originUrl = (root: string) => (root === fleet.workspaceRoot ? "git@github.com:Silthus/fleet.git" : undefined);
    expect(matchProjects([fork, posthog], "github.com/silthus/fleet", originUrl)).toEqual([fork]);
    expect(matchProjects([fork, posthog], "github.com/upstream/fleet", originUrl)).toEqual([fork]);
  });
});

describe("projectRepository", () => {
  test("names a fork by its origin remote, where its branches are pushed", () => {
    const fork = { ...fleet, repositoryIdentity: { canonicalKey: "github.com/upstream/fleet" } };
    expect(projectRepository(fork, () => "git@github.com:Silthus/fleet.git")).toBe("github.com/silthus/fleet");
  });

  test("falls back to the repository identity without an origin remote", () => {
    expect(projectRepository(fleet, () => undefined)).toBe("github.com/silthus/fleet");
  });
});

describe("repositoryKey", () => {
  test("is host and path in lower case for every remote URL form", () => {
    for (const url of [
      "git@github.com:Silthus/fleet.git",
      "https://github.com/Silthus/fleet",
      "https://github.com/Silthus/fleet.git",
      "ssh://git@github.com/Silthus/fleet.git",
    ]) {
      expect(repositoryKey(url)).toBe("github.com/silthus/fleet");
    }
  });
});

describe("callingThread", () => {
  const worktree = "/home/coder/.t3/worktrees/fleet/t3code-335e6425";

  test("is the thread with a running turn in this worktree", () => {
    const shell = {
      projects: [fleet],
      threads: [thread("old", worktree, "completed"), thread("self", worktree, "running"), thread("other", "/tmp/x", "running")],
    };
    expect(callingThread(shell, worktree)?.id).toBe("self");
  });

  test("is a project-root thread when the thread has no worktree", () => {
    const shell = { projects: [fleet], threads: [thread("self", null, "running")] };
    expect(callingThread(shell, fleet.workspaceRoot)?.id).toBe("self");
  });

  test("is found through a symlinked project root", () => {
    const shell = { projects: [fleet], threads: [thread("self", null, "running")] };
    const resolve = (path: string) => path.replace("/home/coder/dev/fleet", "/home/coder/.config/coderv2/dotfiles");
    expect(callingThread(shell, "/home/coder/.config/coderv2/dotfiles", resolve)?.id).toBe("self");
  });

  test("is unknown when two threads run in the same directory", () => {
    const shell = { projects: [fleet], threads: [thread("a", worktree, "running"), thread("b", worktree, "running")] };
    expect(callingThread(shell, worktree)).toBeUndefined();
  });
});

describe("modelFlags", () => {
  test("carries the provider, model, and options of the thread", () => {
    const selection = {
      instanceId: "claudeAgent",
      model: "claude-opus-5-5",
      options: [{ id: "effort", value: "high" }, { id: "fastMode", value: false }, { id: "contextWindow", value: "1m" }],
    };
    expect(modelFlags(selection)).toEqual([
      "--provider", "claudeAgent", "--model", "claude-opus-5-5", "--effort", "high", "--context-window", "1m",
    ]);
  });

  test("omits options the thread does not set", () => {
    expect(modelFlags({ instanceId: "codex", model: "gpt-6.1-sol", options: [] })).toEqual([
      "--provider", "codex", "--model", "gpt-6.1-sol", "--effort", "none", "--context-window", "none",
    ]);
  });
});

describe("remoteCommand", () => {
  test("runs kickoff in a login shell with every argument intact", () => {
    const home = mkdtempSync(join(tmpdir(), "handoff-"));
    const bin = join(home, "bin");
    mkdirSync(bin);
    writeFileSync(join(bin, "bun"), "#!/bin/sh\nprintf '%s\\n' \"$@\"\n", { mode: 0o755 });
    const args = ["--title", "Fix Michael's \"export\" $HOME `id`", "--base", "t3code/abc"];

    const result = spawnSync("/bin/sh", ["-c", remoteCommand(args)], {
      encoding: "utf8",
      env: { HOME: home, SHELL: "/bin/sh", PATH: `${bin}:/usr/bin:/bin` },
    });

    expect(result.stdout.trimEnd().split("\n")).toEqual([`${home}/.agents/skills/t3-kickoff/scripts/kickoff.ts`, ...args]);
  });
});

describe("handoffPrompt", () => {
  test("tells the new thread where the work came from and where to push", () => {
    const prompt = handoffPrompt({ source: "devbox-michaelr-hub", title: "Fix the export", branch: "t3code/abc" }, "Do the rest.");
    expect(prompt).toContain("devbox-michaelr-hub");
    expect(prompt).toContain("Fix the export");
    expect(prompt).toContain("git push origin HEAD:t3code/abc");
    expect(prompt.endsWith("Do the rest.")).toBe(true);
  });
});
