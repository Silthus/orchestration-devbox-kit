---
name: t3-kickoff
description: Start, watch, archive, or delete T3 Code threads from the command line. Use when asked to spawn, kick off, or hand work to a separate T3 thread or session, to wait for a T3 thread's turn to end, or to archive or delete a T3 thread.
---

# T3 kickoff

`scripts/kickoff.ts` does what the T3 web client does on the first message of a new thread: it creates the thread, the worktree, and the first turn in one command against the running T3 server. It reads the server address from `~/.t3/userdata/server-runtime.json`, issues a short bearer session with the server's own binary, and revokes the session when it exits. The token stays in memory. Never print it.

Run it on the machine whose T3 server owns the thread. For a remote box, run it over SSH in a login shell, so `bun` is on `PATH`:

```sh
ssh <host> 'bash -lc "bun ~/.agents/skills/t3-kickoff/scripts/kickoff.ts --dry-run ..."'
```

## Start a thread

1. Write the prompt to a file. The prompt is the thread's first user message, so it carries the full task, the context, and the report the thread owes back.
2. Pick the flags:
   - `--project <name|id|repo>`: a project the server knows, by title, id, or repository such as `github.com/silthus/fleet`. A wrong name lists the known projects. Add `--clone <git-url>` to clone the repository into `~/dev/<name>` and add it as a project when none matches.
   - `--title "<title>"`: the thread title. Add `--auto-title` to let the server replace it.
   - `--model <slug>`: choose with the shared [model selection policy](../../AGENTS.md#model-selection) and pass it explicitly. A wrong slug lists the offered slugs.
   - `--worktree new|none`: `new` checks out `origin/<base>` into a fresh `t3code/<hex>` worktree and runs the project setup script; `none` runs in the project checkout. `--base` sets the base branch (default `master`).
   - `--plan` starts in plan mode. `--help` lists the rest.
3. On a machine that has not run the script before, run the command with `--dry-run` first. Done when it prints `dry run ok: project ... offers <model>`.
4. Run the command without `--dry-run`:

   ```sh
   bun ~/.agents/skills/t3-kickoff/scripts/kickoff.ts --project posthog --title "Fix the export" \
     --provider <selected-provider> --model <selected-model> --worktree new --prompt-file /tmp/prompt.md
   ```

   Done when it prints the thread id on stdout and `turn started` on stderr. Report the thread id and the worktree path.

Start threads one at a time. Two parallel starts race on `git fetch origin` in the same repository. Wait for `turn started` before the next one.

## Watch a thread

```sh
bun ~/.agents/skills/t3-kickoff/scripts/kickoff.ts status --thread <thread-id>
bun ~/.agents/skills/t3-kickoff/scripts/kickoff.ts wait --thread <thread-id> [--after <turn-id>] [--timeout <sec>]
```

`status` prints one JSON line: the latest `turn` (the run id), its `state` (`preparing`, `queued`, `starting`, `running`, `waiting`, `completed`, `failed`, `interrupted`, or `cancelled`), `startedAt`, `completedAt`, the thread's last `error`, and `gone`. `gone: true` means the thread is archived or deleted: the server no longer serves it.

`wait` returns when a turn newer than `--after` ends or the thread is gone. It prints the status line and exits 0, or exits 2 at `--timeout` (default 5400). Run it as a background command, so that its exit is the wake. To wait for the next turn, pass the last `turn` as `--after`.

## Stop or archive a thread

```sh
bun ~/.agents/skills/t3-kickoff/scripts/kickoff.ts stop --thread <thread-id>
bun ~/.agents/skills/t3-kickoff/scripts/kickoff.ts archive --thread <thread-id>
```

`stop` detaches the provider sessions and keeps the thread in the sidebar. `archive` archives the thread; the server releases its sessions. The worktree and its branch stay. `delete` cannot find an archived thread. `archive --when-idle` first waits for the running turn to end, so a thread can archive itself from a detached process.

## Move a thread to another machine

`kickoff handoff --to <alias> --prompt-file <doc>` moves the calling thread to another machine. The `handoff` skill owns the steps around it; follow its `REMOTE.md`.

## Delete a thread

```sh
bun ~/.agents/skills/t3-kickoff/scripts/kickoff.ts delete --thread <thread-id> [--keep-worktree]
```

It deletes the thread and removes the worktree and its `t3code/` branch unless another thread uses them or `--keep-worktree` is set.

## Scripts

- `scripts/kickoff.ts`: the command.
- `scripts/threads.ts`: the status line and the rule for when `wait` returns.
- `scripts/handoff.ts`: the calling thread, project matching by repository, and the remote command for `handoff`.
- `scripts/server.ts`: finds the running server and its binary. On Linux it reads `/proc/<pid>/exe`. On macOS the desktop app runs the server through Electron, so it takes the executable and the server script from `ps` and runs them in Node mode. Run the tests with `bun test` in this directory.
