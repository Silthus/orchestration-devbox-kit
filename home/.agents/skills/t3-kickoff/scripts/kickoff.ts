#!/usr/bin/env bun
// Starts a T3 Code thread the way the web client does on the first message of a new thread:
// one `orchestration.launchThread` call over the server's Effect RPC WebSocket (orchestration protocol 2).
import { spawn, spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { existsSync, openSync, readFileSync, realpathSync } from "node:fs";
import { homedir, hostname, tmpdir } from "node:os";
import { join } from "node:path";
import { callingThread, handoffPrompt, matchProjects, modelFlags, projectRepository, remoteCommand, type Project } from "./handoff.ts";
import { authHeaders, discoverServer, runServerCli, type Server } from "./server.ts";
import { shellThreadStatus, turnEndedAfter, turnStarted, type ThreadStatus } from "./threads.ts";

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
type Flags = Record<string, string | true>;

const USAGE = `usage:
  kickoff --project <name|id> --title <title> --prompt-file <path|-> [options]
  kickoff delete --thread <thread-id> [--keep-worktree]
  kickoff status --thread <thread-id>
  kickoff wait --thread <thread-id> [--after <turn-id>] [--timeout <sec>]
  kickoff stop --thread <thread-id>
  kickoff archive --thread <thread-id> [--when-idle]
  kickoff handoff --to <machine> --prompt-file <path|-> [--title <title>] [--dry-run]

status prints the thread state as one JSON line; "gone": true means archived or deleted.
wait polls until a turn newer than --after ends or the thread is gone, prints the
state, and exits 0. At --timeout (default 5400) it prints the state and exits 2.
stop detaches the thread's provider sessions. archive archives the thread and
lets the server release its sessions; the worktree and its branch stay. --when-idle first waits for the
running turn to end.
handoff moves the calling thread to another machine: it starts a thread there on
the pushed branch with the same repository and model, then archives the calling
thread in the background once its turn ends. --to is an SSH alias, or a Coder
workspace reached as coder.<machine>.

create options:
  --project <name|id|repo>  a project title or id, or a repository such as github.com/owner/name
  --clone <git-url>         if no project matches, clone into ~/dev/<name> and add it to T3
  --model <slug>            model slug (default claude-opus-5-5)
  --provider <instanceId>   provider instance (default claudeAgent = Claude Code)
  --effort <level>          reasoning effort option (default high; "none" to omit)
  --context-window <size>   context window option (default 1m; "none" to omit)
  --worktree new|none       new: fresh worktree on t3code/<hex> (default new)
  --base <branch>           base branch for the worktree (default master)
  --no-origin               branch from local <base> instead of fetching origin/<base>
  --runtime-mode <mode>     full-access|auto|auto-accept-edits|approval-required (default full-access)
  --plan                    start in plan interaction mode
  --no-wait                 return right after dispatch, do not wait for the turn to start
  --auto-title              let the server replace --title with a generated title
  --dry-run                 authenticate, resolve project and model, then stop
  --timeout <sec>           max wait for worktree + turn start (default 300)
`;

function parseArgs(argv: string[]): { cmd: string; flags: Flags } {
  let cmd = "create";
  const flags: Flags = {};
  let i = 0;
  if (argv[0] && !argv[0].startsWith("--")) {
    cmd = argv[0];
    i = 1;
  }
  for (; i < argv.length; i++) {
    const a = argv[i]!;
    if (!a.startsWith("--")) die(`unexpected argument: ${a}`);
    const eq = a.indexOf("=");
    if (eq > 0) {
      flags[a.slice(2, eq)] = a.slice(eq + 1);
    } else if (argv[i + 1] !== undefined && !argv[i + 1]!.startsWith("--")) {
      flags[a.slice(2)] = argv[++i]!;
    } else {
      flags[a.slice(2)] = true;
    }
  }
  return { cmd, flags };
}

function die(msg: string): never {
  process.stderr.write(`kickoff: ${msg}\n`);
  process.exit(1);
}
function fail(msg: string): never {
  throw new Error(msg);
}
function log(msg: string): void {
  process.stderr.write(`kickoff: ${msg}\n`);
}
function str(flags: Flags, key: string, dflt?: string): string | undefined {
  const v = flags[key];
  if (v === undefined) return dflt;
  if (v === true) die(`--${key} needs a value`);
  return v;
}

type Session = { sessionId: string; token: string };

// The session comes from the running server's own binary: a newer CLI would migrate the live database.
function issueSession(server: Server, ttlMinutes = 10): Session {
  const r = runServerCli(server, ["auth", "session", "issue", "--json", "--ttl", `${ttlMinutes}m`, "--label", "t3-kickoff", "--subject", "t3-kickoff"]);
  if (r.status !== 0) die(`t3 auth session issue failed (exit ${r.status}): ${r.stderr?.trim().slice(0, 500)}`);
  const start = r.stdout.indexOf("{");
  if (start < 0) die("t3 auth session issue printed no JSON");
  const parsed = JSON.parse(r.stdout.slice(start)) as { sessionId: string; token: string };
  if (!parsed.sessionId || !parsed.token) die("t3 auth session issue JSON lacks sessionId/token");
  return { sessionId: parsed.sessionId, token: parsed.token };
}

function revokeSession(server: Server, s: Session): void {
  const r = runServerCli(server, ["auth", "session", "revoke", s.sessionId]);
  if (r.status !== 0) log(`warning: could not revoke session ${s.sessionId}; it expires on its own`);
  else log(`revoked auth session ${s.sessionId}`);
}

async function withSession<T>(run: (server: Server, session: Session) => Promise<T>, ttlMinutes?: number): Promise<T> {
  const server = discoverServer();
  const session = issueSession(server, ttlMinutes);
  try {
    return await run(server, session);
  } finally {
    revokeSession(server, session);
  }
}

async function dispatch(server: Server, session: Session, commands: Json[]): Promise<void> {
  const rpc = await Rpc.connect(server, session);
  try {
    for (const command of commands) await rpc.call("orchestration.dispatchCommand", command);
  } finally {
    rpc.close();
  }
}

async function httpGet(server: Server, s: Session, path: string): Promise<any> {
  const res = await fetch(server.origin + path, { headers: authHeaders(s.token) });
  if (!res.ok) throw new Error(`GET ${path} -> ${res.status} ${(await res.text()).slice(0, 300)}`);
  return res.json();
}

class Rpc {
  private ws!: WebSocket;
  private nextId = 1;
  private pending = new Map<string, { resolve: (v: any) => void; reject: (e: Error) => void; chunks: any[] }>();

  static async connect(server: Server, s: Session): Promise<Rpc> {
    const rpc = new Rpc();
    // Bun's WebSocket accepts request headers, so the bearer never goes in the URL.
    rpc.ws = new WebSocket(server.wsUrl, { headers: authHeaders(s.token) } as any);
    await new Promise<void>((resolve, reject) => {
      rpc.ws.onopen = () => resolve();
      rpc.ws.onerror = () => reject(new Error(`websocket connect to ${server.wsUrl} failed`));
    });
    rpc.ws.onmessage = (ev) => rpc.onMessage(String(ev.data));
    rpc.ws.onclose = (ev) => {
      for (const p of rpc.pending.values()) p.reject(new Error(`websocket closed (${ev.code})`));
      rpc.pending.clear();
    };
    return rpc;
  }

  private send(msg: Json): void {
    this.ws.send(JSON.stringify(msg));
  }

  private onMessage(raw: string): void {
    let decoded: any;
    try {
      decoded = JSON.parse(raw);
    } catch {
      return;
    }
    for (const m of Array.isArray(decoded) ? decoded : [decoded]) {
      switch (m?._tag) {
        case "Ping":
          this.send({ _tag: "Pong" });
          break;
        case "Chunk": {
          const p = this.pending.get(String(m.requestId));
          if (p) p.chunks.push(...(m.values ?? []));
          this.send({ _tag: "Ack", requestId: String(m.requestId) });
          break;
        }
        case "Exit": {
          const p = this.pending.get(String(m.requestId));
          if (!p) break;
          this.pending.delete(String(m.requestId));
          if (m.exit?._tag === "Success") p.resolve(m.exit.value);
          else p.reject(new Error(`rpc failed: ${JSON.stringify(m.exit).slice(0, 1500)}`));
          break;
        }
        case "Defect":
        case "ClientProtocolError":
          for (const p of this.pending.values()) p.reject(new Error(`rpc ${m._tag}: ${JSON.stringify(m).slice(0, 800)}`));
          this.pending.clear();
          break;
      }
    }
  }

  call(tag: string, payload: Json, timeoutMs = 120_000): Promise<any> {
    const id = String(this.nextId++);
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`rpc ${tag} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
      this.pending.set(id, {
        resolve: (v) => (clearTimeout(timer), resolve(v)),
        reject: (e) => (clearTimeout(timer), reject(e)),
        chunks: [],
      });
      this.send({ _tag: "Request", id, tag, payload, headers: [] });
    });
  }

  close(): void {
    try {
      this.ws.close();
    } catch {}
  }
}

async function create(flags: Flags): Promise<void> {
  const projectArg = str(flags, "project") ?? die(`--project is required\n${USAGE}`);
  const title = str(flags, "title") ?? die(`--title is required\n${USAGE}`);
  const promptFile = str(flags, "prompt-file") ?? die(`--prompt-file is required\n${USAGE}`);
  const model = str(flags, "model", "claude-opus-5-5")!;
  const provider = str(flags, "provider", "claudeAgent")!;
  const effort = str(flags, "effort", "high")!;
  const contextWindow = str(flags, "context-window", "1m")!;
  const worktree = str(flags, "worktree", "new")!;
  if (worktree !== "new" && worktree !== "none") die("--worktree must be new or none");
  const base = str(flags, "base", "master")!;
  const runtimeMode = str(flags, "runtime-mode", "full-access")!;
  const interactionMode = flags["plan"] ? "plan" : "default";
  const wait = !flags["no-wait"];
  const timeoutSec = Number(str(flags, "timeout", "300"));

  const prompt = (promptFile === "-" ? readFileSync(0, "utf8") : readFileSync(promptFile, "utf8")).replace(/\s+$/, "");
  if (!prompt) die("prompt is empty");

  await withSession(async (server, session) => {
    let rpc: Rpc | undefined;
    try {
      const project = await resolveProject(server, session, projectArg, str(flags, "clone"), !!flags["dry-run"]);

      rpc = await Rpc.connect(server, session);

      const config = await rpc.call("server.getConfig", {});
      const prov = (config.providers as any[]).find((p) => p.instanceId === provider);
      if (!prov) fail(`provider instance "${provider}" not found; have: ${(config.providers as any[]).map((p) => p.instanceId).join(", ")}`);
      const slugs: string[] = (prov.models ?? []).map((m: any) => m.slug);
      if (slugs.length && !slugs.includes(model)) fail(`model "${model}" not offered by ${provider}; have: ${slugs.join(", ")}`);

      const options: Json[] = [];
      if (effort !== "none") options.push({ id: "effort", value: effort });
      options.push({ id: "fastMode", value: false });
      if (contextWindow !== "none") options.push({ id: "contextWindow", value: contextWindow });
      const modelSelection = { instanceId: provider, model, options };

      if (flags["dry-run"]) {
        log(`dry run ok: project ${project.title} (${project.id}) at ${project.workspaceRoot}; ${provider} offers ${model}`);
        return;
      }

      const workspaceStrategy =
        worktree === "new" ? { type: "worktree", baseRef: base, startFromOrigin: !flags["no-origin"] } : { type: "root" };
      const launch = {
        commandId: randomUUID(),
        projectId: project.id,
        title,
        // A generated title replaces --title, so only ask for one with --auto-title.
        generateTitle: !!flags["auto-title"],
        modelSelection,
        runtimeMode,
        interactionMode,
        workspaceStrategy,
        initialMessage: { text: prompt, attachments: [] },
      };
      log(`launching thread (project ${project.title}, ${provider}/${model}, worktree ${worktree})`);
      // The server holds this call open until the worktree is ready and the first run is queued.
      const { threadId } = await rpc.call("orchestration.launchThread", launch as Json, timeoutSec * 1000);
      process.stdout.write(`${threadId}\n`);

      if (wait) await waitForTurn(server, session, threadId, timeoutSec);
    } finally {
      rpc?.close();
    }
  });
}

async function resolveProject(server: Server, session: Session, key: string, cloneUrl: string | undefined, dryRun: boolean): Promise<Project> {
  const projects = async () => (await httpGet(server, session, "/api/orchestration/shell")).projects as Project[];
  let matches = matchProjects(await projects(), key, originUrl);
  if (matches.length === 0 && cloneUrl && !dryRun) {
    addProject(server, cloneUrl);
    matches = matchProjects(await projects(), key, originUrl);
  }
  if (matches.length !== 1) fail(`project "${key}" matched ${matches.length} projects; have: ${(await projects()).map((p) => p.title).join(", ")}`);
  return matches[0]!;
}

function addProject(server: Server, cloneUrl: string): void {
  const name = cloneUrl.replace(/\.git$/, "").split(/[/:]/).pop()!;
  const path = join(homedir(), "dev", name);
  if (!existsSync(path)) {
    log(`cloning ${cloneUrl} into ${path}`);
    const clone = spawnSync("git", ["clone", cloneUrl, path], { encoding: "utf8" });
    if (clone.status !== 0) fail(`git clone failed: ${clone.stderr.trim().slice(0, 500)}`);
  }
  const added = runServerCli(server, ["project", "add", path]);
  if (added.status !== 0) fail(`t3 project add ${path} failed: ${added.stderr.trim().slice(0, 500)}`);
  log(`added project ${path}`);
}

async function waitForTurn(server: Server, session: Session, threadId: string, timeoutSec: number): Promise<void> {
  const deadline = Date.now() + timeoutSec * 1000;
  for (;;) {
    const current = await readStatus(server, session, threadId);
    if (current.state === "failed") fail(`thread run failed: ${current.error}`);
    if (turnStarted(current)) {
      const t = (await threadDetail(server, session, threadId)).thread;
      log(`turn started: run=${current.turn} state=${current.state} branch=${t.branch} worktree=${t.worktreePath}`);
      return;
    }
    if (current.gone) fail(`thread ${threadId} disappeared before its first run started`);
    if (Date.now() > deadline) fail(`timed out waiting for the first run to start`);
    await Bun.sleep(1000);
  }
}

async function threadDetail(server: Server, session: Session, threadId: string): Promise<any> {
  return (await httpGet(server, session, `/api/orchestration/threads/${encodeURIComponent(threadId)}?turnLimit=1`)).projection;
}

function liveProviderSessions(detail: any): string[] {
  return ((detail.providerSessions ?? []) as Array<{ id: string; status: string }>).filter((p) => p.status !== "stopped").map((p) => p.id);
}

function detachCommands(threadId: string, providerSessionIds: string[]): Json[] {
  return providerSessionIds.map((providerSessionId) => ({ type: "provider-session.detach", commandId: randomUUID(), threadId, providerSessionId }));
}

async function remove(flags: Flags): Promise<void> {
  const threadId = str(flags, "thread") ?? die("--thread is required");
  const keepWorktree = !!flags["keep-worktree"];
  await withSession(async (server, session) => {
    let rpc: Rpc | undefined;
    try {
      const t = (await threadDetail(server, session, threadId)).thread;
      const shell = await httpGet(server, session, "/api/orchestration/shell");
      const project = (shell.projects as any[]).find((p) => p.id === t.projectId);
      const otherUsers = (shell.threads as any[]).filter((x) => x.id !== threadId && x.worktreePath && x.worktreePath === t.worktreePath);

      rpc = await Rpc.connect(server, session);
      await rpc.call("orchestration.dispatchCommand", { type: "thread.delete", commandId: randomUUID(), threadId });
      log(`deleted thread ${threadId}`);

      if (!keepWorktree && t.worktreePath && project && otherUsers.length === 0 && t.worktreePath !== project.workspaceRoot) {
        await removeWorktree(rpc, project.workspaceRoot, t.worktreePath);
        log(`removed worktree ${t.worktreePath}`);
        const branchShared = (shell.threads as any[]).some((x) => x.id !== threadId && x.branch === t.branch);
        if (typeof t.branch === "string" && t.branch.startsWith("t3code/") && !branchShared) {
          const r = spawnSync("git", ["-C", project.workspaceRoot, "branch", "-D", t.branch], { encoding: "utf8" });
          log(r.status === 0 ? `deleted branch ${t.branch}` : `branch ${t.branch} not deleted: ${r.stderr.trim()}`);
        }
      }
    } finally {
      rpc?.close();
    }
  });
}

async function removeWorktree(rpc: Rpc, workspaceRoot: string, worktreePath: string): Promise<void> {
  try {
    await rpc.call("vcs.removeWorktree", { cwd: workspaceRoot, path: worktreePath, force: true });
  } catch (e) {
    // `git worktree remove --force` fails on read-only trees such as the Go module cache a flox
    // activation leaves in .flox/cache. Fall back to a plain delete, but only inside T3's own worktree directory.
    const root = join(homedir(), ".t3/worktrees") + "/";
    if (!worktreePath.startsWith(root)) throw e;
    log(`vcs.removeWorktree failed; deleting ${worktreePath} directly`);
    spawnSync("chmod", ["-R", "u+w", "--", worktreePath]);
    const rm = spawnSync("rm", ["-rf", "--", worktreePath], { encoding: "utf8" });
    if (rm.status !== 0) throw new Error(`rm -rf ${worktreePath} failed: ${rm.stderr.slice(0, 300)}`);
    spawnSync("git", ["-C", workspaceRoot, "worktree", "prune"]);
  }
}

async function readStatus(server: Server, session: Session, threadId: string): Promise<ThreadStatus> {
  return shellThreadStatus(await httpGet(server, session, "/api/orchestration/shell"), threadId);
}

function printStatus(status: ThreadStatus): void {
  process.stdout.write(`${JSON.stringify(status)}\n`);
}

async function status(flags: Flags): Promise<void> {
  const threadId = str(flags, "thread") ?? die("--thread is required");
  await withSession(async (server, session) => printStatus(await readStatus(server, session, threadId)));
}

async function waitForTurnEnd(flags: Flags): Promise<void> {
  const threadId = str(flags, "thread") ?? die("--thread is required");
  const previousTurn = str(flags, "after");
  const timeoutSec = Number(str(flags, "timeout", "5400"));
  if (!Number.isFinite(timeoutSec) || timeoutSec < 0) die("--timeout must be a number of seconds");
  const ended = await withSession(
    (server, session) => pollUntilTurnEnds(server, session, threadId, previousTurn, timeoutSec, printStatus),
    Math.ceil(timeoutSec / 60) + 2,
  );
  if (!ended) process.exit(2);
}

async function pollUntilTurnEnds(
  server: Server,
  session: Session,
  threadId: string,
  previousTurn: string | undefined,
  timeoutSec: number,
  onDone: (status: ThreadStatus) => void = () => {},
): Promise<boolean> {
  const deadline = Date.now() + timeoutSec * 1000;
  for (;;) {
    const current = await readStatus(server, session, threadId);
    const ended = turnEndedAfter(current, previousTurn);
    if (ended || Date.now() > deadline) {
      onDone(current);
      return ended;
    }
    await Bun.sleep(5000);
  }
}

async function stop(flags: Flags): Promise<void> {
  const threadId = str(flags, "thread") ?? die("--thread is required");
  await withSession(async (server, session) => {
    if ((await readStatus(server, session, threadId)).gone) fail(`thread ${threadId} is archived or deleted`);
    const live = liveProviderSessions(await threadDetail(server, session, threadId));
    if (live.length) await dispatch(server, session, detachCommands(threadId, live));
    log(`detached ${live.length} provider session(s) of thread ${threadId}`);
  });
}

async function archive(flags: Flags): Promise<void> {
  const threadId = str(flags, "thread") ?? die("--thread is required");
  const timeoutSec = Number(str(flags, "timeout", "5400"));
  const whenIdle = !!flags["when-idle"];
  await withSession(async (server, session) => {
    if (whenIdle && !(await pollUntilTurnEnds(server, session, threadId, undefined, timeoutSec))) fail("the turn did not end in time; thread not archived");
    if ((await readStatus(server, session, threadId)).gone) return log(`thread ${threadId} is already archived or deleted`);
    await dispatch(server, session, [{ type: "thread.archive", commandId: randomUUID(), threadId }]);
    log(`archived thread ${threadId}`);
  }, whenIdle ? Math.ceil(timeoutSec / 60) + 2 : undefined);
}

function git(args: string[]): string {
  const r = spawnSync("git", args, { encoding: "utf8" });
  if (r.status !== 0) fail(`git ${args.join(" ")} failed: ${r.stderr.trim()}`);
  return r.stdout.trim();
}

function pushedBranch(): string {
  const branch = spawnSync("git", ["symbolic-ref", "--short", "HEAD"], { encoding: "utf8" }).stdout.trim();
  if (!branch) fail("HEAD is detached; check out a branch, then commit and push it");
  if (git(["status", "--porcelain"])) fail("the worktree has uncommitted changes; commit and push them first");
  const remote = git(["ls-remote", "origin", `refs/heads/${branch}`]).split(/\s/)[0];
  if (remote !== git(["rev-parse", "HEAD"])) fail(`origin/${branch} is not at HEAD; push the branch first`);
  return branch;
}

function originUrl(workspaceRoot: string): string | undefined {
  const r = spawnSync("git", ["-C", workspaceRoot, "remote", "get-url", "origin"], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : undefined;
}

function realPath(path: string): string {
  return existsSync(path) ? realpathSync(path) : path;
}

function sshDestination(machine: string): string {
  const hostName = /^hostname (.+)$/m.exec(spawnSync("ssh", ["-G", machine], { encoding: "utf8" }).stdout)?.[1];
  const hasAlias = hostName !== undefined && hostName.toLowerCase() !== machine.toLowerCase();
  return hasAlias ? machine : `coder.${machine}`;
}

async function handoff(flags: Flags): Promise<void> {
  const machine = str(flags, "to") ?? die(`--to is required\n${USAGE}`);
  const promptFile = str(flags, "prompt-file") ?? die(`--prompt-file is required\n${USAGE}`);
  const handoffText = (promptFile === "-" ? readFileSync(0, "utf8") : readFileSync(promptFile, "utf8")).trim();
  if (!handoffText) die("prompt is empty");
  const dryRun = !!flags["dry-run"];

  const cwd = realPath(git(["rev-parse", "--show-toplevel"]));
  const branch = pushedBranch();
  const { self, project } = await withSession(async (server, session) => {
    const shell = await httpGet(server, session, "/api/orchestration/shell");
    const self = callingThread(shell, cwd, realPath) ?? fail(`no single running thread in ${cwd}; run handoff from the thread that hands off`);
    const project = (shell.projects as Project[]).find((p) => p.id === self.projectId)!;
    return { self, project };
  });
  const repo = projectRepository(project, originUrl) ?? fail(`project ${project.title} has no repository identity or origin remote`);
  const cloneUrl = project.repositoryIdentity?.locator?.remoteUrl ?? originUrl(project.workspaceRoot);

  const prompt = handoffPrompt({ source: hostname(), title: self.title, branch }, handoffText);
  const args = [
    "--project", repo, "--title", str(flags, "title") ?? self.title, ...modelFlags(self.modelSelection),
    "--worktree", "new", "--base", branch, "--prompt-file", "-",
    ...(cloneUrl ? ["--clone", cloneUrl] : []), ...(dryRun ? ["--dry-run"] : []),
  ];
  const destination = sshDestination(machine);
  log(`starting the thread on ${destination} (${repo} at ${branch})`);
  const remote = spawnSync("ssh", [destination, remoteCommand(args)], { input: prompt, encoding: "utf8", stdio: ["pipe", "pipe", "inherit"] });
  if (remote.status !== 0) fail(`kickoff on ${destination} failed (exit ${remote.status})`);
  if (dryRun) return log(`dry run ok: ${machine} can start the thread; ${self.id} stays`);

  const newThread = remote.stdout.trim().split("\n").pop();
  process.stdout.write(`${machine} ${newThread}\n`);
  archiveWhenIdle(self.id);
}

// Detached, so it outlives this turn and archives the thread once the turn ends.
function archiveWhenIdle(threadId: string): void {
  const logPath = join(tmpdir(), `t3-handoff-${threadId}.log`);
  const out = openSync(logPath, "a");
  spawn(process.execPath, [process.argv[1]!, "archive", "--thread", threadId, "--when-idle"], {
    detached: true,
    stdio: ["ignore", out, out],
  }).unref();
  log(`archives thread ${threadId} when this turn ends; log: ${logPath}`);
}

const commands: Record<string, (flags: Flags) => Promise<void>> = {
  create,
  handoff,
  delete: remove,
  status,
  wait: waitForTurnEnd,
  stop,
  archive,
};

const { cmd, flags } = parseArgs(process.argv.slice(2));
if (flags["help"]) {
  process.stdout.write(USAGE);
  process.exit(0);
}
const run = commands[cmd] ?? die(`unknown command ${cmd}\n${USAGE}`);
run(flags).then(
  () => process.exit(0),
  (e) => die(e instanceof Error ? e.message : String(e)),
);
