import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import { existsSync, readFileSync, readlinkSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { platform } from "node:process";

export type ServerCommand = { command: string; args: string[] };

export type Server = { origin: string; wsUrl: string; cli: ServerCommand };

const SCRIPT_ARG = /^(\/.*?\.[cm]?js)(?:\s|$)/;

// The server rejects HTTP requests and WebSocket upgrades that do not declare the protocol it speaks.
const ORCHESTRATION_PROTOCOL = "2";

export function authHeaders(token: string): Record<string, string> {
  return { authorization: `Bearer ${token}`, "x-t3-orchestration-protocol": ORCHESTRATION_PROTOCOL };
}

export function wsUrl(origin: string): string {
  const url = new URL(origin);
  return `${url.protocol === "https:" ? "wss" : "ws"}://${url.host}/ws?orchestrationProtocol=${ORCHESTRATION_PROTOCOL}`;
}

export function discoverServer(): Server {
  const runtimePath = join(homedir(), ".t3/userdata/server-runtime.json");
  if (!existsSync(runtimePath)) throw new Error(`no running T3 server (${runtimePath} missing)`);
  const runtime = JSON.parse(readFileSync(runtimePath, "utf8")) as { pid: number; origin: string };
  const cli = resolveServerCommand(runtime.pid);
  if (!cli) throw new Error(`T3 server pid ${runtime.pid} from ${runtimePath} is not running`);
  return { origin: runtime.origin, wsUrl: wsUrl(runtime.origin), cli };
}

function resolveServerCommand(pid: number): ServerCommand | undefined {
  return platform === "darwin" ? darwinServerCommand(pid) : linuxServerCommand(pid);
}

function linuxServerCommand(pid: number): ServerCommand | undefined {
  try {
    const command = readlinkSync(`/proc/${pid}/exe`);
    const argv = readFileSync(`/proc/${pid}/cmdline`, "utf8").split("\0");
    return { command, args: scriptArgs(argv[1] ?? "") };
  } catch {
    return undefined;
  }
}

function darwinServerCommand(pid: number): ServerCommand | undefined {
  const comm = ps(pid, "comm");
  const args = ps(pid, "args");
  if (!comm || args === undefined) return undefined;
  return parseDarwinCommand(comm, args);
}

function ps(pid: number, column: "comm" | "args"): string | undefined {
  const result = spawnSync("ps", ["-p", String(pid), "-o", `${column}=`], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : undefined;
}

export function parseDarwinCommand(comm: string, args: string): ServerCommand {
  const rest = args.startsWith(comm) ? args.slice(comm.length).trim() : "";
  const bundle = /^(.*\.app)\/Contents\/MacOS\/[^/]+$/.exec(comm)?.[1];
  if (bundle) {
    const script = `${bundle}/Contents/Resources/app.asar/apps/server/dist/bin.mjs`;
    if (!(` ${rest} `).includes(` ${script} `)) throw new Error("Cannot identify the T3 desktop server script");
    return { command: comm, args: [script] };
  }
  return { command: comm, args: scriptArgs(rest) };
}

function scriptArgs(candidate: string): string[] {
  const match = SCRIPT_ARG.exec(candidate);
  return match ? [match[1]!] : [];
}

export function runServerCli(server: Server, argv: string[]): SpawnSyncReturns<string> {
  const { command, args } = server.cli;
  // The desktop app runs its server through Electron in Node mode; a native `t3` binary ignores the variable.
  const env = args.length ? { ...process.env, ELECTRON_RUN_AS_NODE: "1" } : process.env;
  return spawnSync(command, [...args, ...argv], { encoding: "utf8", env });
}
