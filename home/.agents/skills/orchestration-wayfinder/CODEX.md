# Orchestration Wayfinder — Codex runtime

Read this addendum only when Codex drives. [`SKILL.md`](SKILL.md) is the source of truth for tracker semantics and the conductor loop.

## Dispatch surfaces

- Human-enterable HITL work uses native Codex tasks. This includes grilling and the parked phase of prototypes, specs, and HITL tasks.
- Ordinary AFK research, tasks, and implementation use subagents. When parallel writers need filesystem isolation, dispatch them as unpinned native worktree tasks. Also use an unpinned native task when the user explicitly wants background work visible as a task.
- The explicit user invocation of `/orchestration-wayfinder` authorizes the native tasks required by its map. If the skill was not explicitly invoked or the user did not authorize tasks, ask once before the first creation.
- Prefer native task tools over detached `codex exec`. Use the CLI only when native task tools are unavailable and report that fallback.

Follow **Casting** in [`SKILL.md`](SKILL.md).

## Create a native task

1. Call `list_projects`, then `create_thread` against the repo project.
2. Use a worktree when the worker may write prototypes, specs, docs, or code. A tracker-only grilling may use the saved project directly.
3. Make the ticket title the task title. Prompt the worker to claim first, obey its ticket skill, park durably, and leave downstream dispatch to the conductor. An implementation task also carries its ship terminal per [`SHIP.md`](SHIP.md): the proof bundle, the draft pull request, and its review.
4. Record the returned locator on the ticket immediately:

   ```md
   <!-- orchestration-wayfinder-dispatch -->

   Runtime: Codex
   Client thread: <clientThreadId>
   Setup: queued-worktree
   ```

5. A queued `clientThreadId` is live setup, not an orphan. Do not create a duplicate. When setup yields the canonical `threadId`, record a newer marked locator comment and use that id thereafter:

   ```md
   <!-- orchestration-wayfinder-dispatch -->

   Runtime: Codex
   Thread: <threadId>
   ```

6. Set a concise title. Keep the task unpinned during setup and its AFK stretch.
7. Emit the app's required directive after successful creation: `::created-thread{clientThreadId="..."}` while queued, or `::created-thread{threadId="..."}` when returned directly.

## Attention rail

Pin state is derived UI, not truth:

| Tracker/task state                    | Codex projection                 |
| ------------------------------------- | -------------------------------- |
| queued worktree                       | unpinned; setup remains live     |
| active AFK or HITL grounding/building | unpinned                         |
| first durable HITL park               | pin and cue once                 |
| later parks in the same ticket        | remain pinned; no repeated relay |
| durable resolution + closed ticket    | unpin, then archive              |

At the first park, verify the park comment and `wayfinder:awaiting-human`, call `set_thread_pinned` with `pinned: true`, and cue the user once. Record `<!-- orchestration-wayfinder-cue:<threadId> -->` on the ticket; its presence suppresses repeat cues.

Resolve in this order:

1. Worker posts the answer and relevant artifact, branch/commit, and verification links.
2. Worker closes the ticket and removes `wayfinder:awaiting-human`.
3. Conductor verifies the durable handoff.
4. Conductor calls `set_thread_pinned` with `pinned: false`, then `set_thread_archived` with `archived: true`.
5. Conductor re-queries the frontier and creates downstream tasks.

Archiving before the durable handoff hides the only useful context. Workers never create downstream tasks.

## Recovery

Reconstruct from GitHub plus `list_threads` and `read_thread`; never message a task to ask its state. A ticket whose latest locator says `Runtime: T3 Code` recovers through [`T3.md`](T3.md) instead.

- Latest marked locator has `Client thread` only and is younger than 15 minutes → setup is still pending. Keep the claim and do not duplicate.
- Client-only setup is older than 15 minutes → search `list_threads` by ticket title and locator. If no canonical task exists, mark that locator stale, unassign, and redispatch once. A second stale setup becomes a durable orchestration failure surfaced to the user instead of an unbounded retry.
- Open assigned ticket + live task/subagent + no awaiting label → active; leave unpinned.
- Open assigned ticket + awaiting label + live task → parked; ensure pinned.
- Closed ticket + recorded task → verify handoff, unpin, archive.
- Open AFK ticket with no live worker → unassign and redispatch.
- Open parked HITL ticket whose task is gone → create a successor from the durable park comment and record its new id. Keep it unpinned until its first durable park, then pin it, cue once, and record `<!-- orchestration-wayfinder-cue:<successorThreadId> -->`; the predecessor's marker does not suppress this cue.
- Invalidated ticket with a task → clear `wayfinder:awaiting-human`, call `set_thread_pinned` with `pinned: false`, then archive the task after recording the invalidation.

Task completion notifications only trigger this reconciliation. They never trigger a message back to the task.
