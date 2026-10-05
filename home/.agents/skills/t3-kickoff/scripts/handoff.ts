// Pure parts of `kickoff handoff`: which thread is calling, which project on the target holds the same
// repository, and the command that starts the new thread there.

export type Project = {
  id: string;
  title: string;
  workspaceRoot: string;
  repositoryIdentity?: { canonicalKey?: string; locator?: { remoteUrl?: string } } | null;
};

export type ShellThread = {
  id: string;
  title: string;
  projectId: string;
  worktreePath: string | null;
  modelSelection: ModelSelection;
  archivedAt?: string | null;
  status: string;
};

export type ModelSelection = { instanceId: string; model: string; options?: Array<{ id: string; value: unknown }> };

type OriginUrl = (workspaceRoot: string) => string | undefined;

export function matchProjects<P extends Project>(projects: P[], key: string, originUrl: OriginUrl = () => undefined): P[] {
  const repository = key.toLowerCase();
  return projects.filter((p) => p.id === key || p.title === key || projectRepositories(p, originUrl).includes(repository));
}

// The origin remote names the repository a branch is pushed to. T3 may leave repositoryIdentity empty,
// or point a fork's identity at its upstream, so the identity is only the fallback.
export function projectRepository(project: Project, originUrl: OriginUrl): string | undefined {
  return projectRepositories(project, originUrl)[0];
}

function projectRepositories(project: Project, originUrl: OriginUrl): string[] {
  const remoteUrl = originUrl(project.workspaceRoot);
  const keys = [remoteUrl && repositoryKey(remoteUrl), project.repositoryIdentity?.canonicalKey?.toLowerCase()];
  return keys.filter((k): k is string => !!k);
}

export function repositoryKey(remoteUrl: string): string | undefined {
  const match = /^(?:[a-z+]+:\/\/)?(?:[^@/]+@)?([^/:]+)[:/](.+?)(?:\.git)?\/?$/i.exec(remoteUrl.trim());
  return match ? `${match[1]}/${match[2]}`.toLowerCase() : undefined;
}

export function callingThread<T extends ShellThread>(
  shell: { projects: Project[]; threads: T[] },
  cwd: string,
  resolve: (path: string) => string = (path) => path,
): T | undefined {
  const rootOf = (t: T) => t.worktreePath ?? shell.projects.find((p) => p.id === t.projectId)?.workspaceRoot;
  const runsIn = (t: T) => {
    const root = rootOf(t);
    return root !== undefined && resolve(root) === cwd;
  };
  const running = shell.threads.filter((t) => !t.archivedAt && t.status === "running" && runsIn(t));
  return running.length === 1 ? running[0] : undefined;
}

export function modelFlags(selection: ModelSelection): string[] {
  const option = (id: string) => {
    const value = selection.options?.find((o) => o.id === id)?.value;
    return typeof value === "string" ? value : "none";
  };
  return ["--provider", selection.instanceId, "--model", selection.model, "--effort", option("effort"), "--context-window", option("contextWindow")];
}

export function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

// The remote login shell puts bun on PATH: bash on a devbox, zsh on the Mac.
export function remoteCommand(kickoffArgs: string[]): string {
  const kickoff = ["bun", '"$HOME/.agents/skills/t3-kickoff/scripts/kickoff.ts"', ...kickoffArgs.map(shellQuote)].join(" ");
  return `exec "$SHELL" -lc ${shellQuote(kickoff)}`;
}

export type HandoffSource = { source: string; title: string; branch: string };

export function handoffPrompt({ source, title, branch }: HandoffSource, handoff: string): string {
  return [
    `This thread continues work handed off from the thread "${title}" on ${source}. That thread is archived.`,
    `Your worktree starts at origin/${branch}. Push your commits to that branch with \`git push origin HEAD:${branch}\`, so an open pull request follows the work. If a pull request exists for ${branch}, link it to this thread.`,
    "",
    handoff,
  ].join("\n");
}
