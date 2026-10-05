---
name: orchestration-wayfinder
description: Drive a whole wayfinder map from one session — planning through implementation — by dispatching one worker per frontier ticket.
disable-model-invocation: true
---

# Orchestration Wayfinder

One conductor drives a `/wayfinder` map from fog through built code. Ticket workers resolve one ticket each; the conductor keeps the frontier moving and surfaces only the work that needs the human.

## Foundation

Read [`/wayfinder`](../wayfinder/SKILL.md) completely first. Its map, child tickets, native blocking, claims, frontier, parks, fog, and resolution protocol remain authoritative.

Before the first dispatch, recovery, or attention-state action, identify the runtime and read exactly one addendum completely:

- Codex drives → [`CODEX.md`](CODEX.md)
- Claude Code drives → [`CLAUDE.md`](CLAUDE.md)

When the conductor runs inside T3 Code (`T3CODE_HOME` is set), also read [`T3.md`](T3.md) before the first dispatch: grilling and prototype tickets get their own T3 threads.

The addenda contain only task/session mechanics. Load only the matching runtime addendum. This file owns the shared tracker and conductor protocol.

## Ownership

The **conductor owns map-level coordination**: query and mutate map structure, blockers, frontier, dispatch, recovery, and projected human-attention state. It may record and close an invalidated ticket as scope reconciliation, but it never performs a worker's substantive ticket-resolution mutations.

The **ticket worker owns one ticket's resolution**: mutate only that ticket's assignment, comments, labels, resolution, and closure — plus, for an implementation ticket, its own branch, pull request, and merge; use its prescribed skill; and stop after closing it. A worker never mutates other tickets or map-level orchestration state and never dispatches downstream work. The conductor never supplies the human side of a HITL decision or answers a ticket's substantive question.

Charting is the sole undispatched act. With no map, chart it live through Wayfinder's Chart mode and declare in **Notes** that execution remains inside the map.

## One map, root to leaves

Planning and execution share one tree. A resolved spec publishes its spec child and implementation children beneath it; those become new frontier tickets. The destination is reached in this map, not handed to a second tracker.

## Ticket types

| Type        | Human loop      | Dispatch                                  | Resolution                                  |
| ----------- | --------------- | ----------------------------------------- | ------------------------------------------- |
| `grilling`  | live throughout | serial, one at a time                     | `/batch-grill-me` + `/domain-modeling`      |
| `prototype` | decision at end | parallel AFK stretch, then park           | `/prototype`, throwaway                     |
| `spec`      | decision at end | parallel AFK stretch, then park           | `/to-spec` + `/to-tickets`                  |
| `research`  | none            | parallel                                  | `/research`, throwaway                      |
| `task`      | as required     | parallel when AFK                         | prerequisite work for a decision            |
| `implement` | none            | parallel when write scopes do not collide | `/implement` + `/tdd`, then [ship](SHIP.md) |

One grilling ticket is one live exchange, and `/batch-grill-me` works it in rounds: the whole answerable frontier goes to the human at once, then the tree reshapes. Serial applies to the ticket, not to its questions.

## Casting

Use runtime-native workers and choose their models with the shared [model selection policy](../../AGENTS.md#model-selection). Apply it to UI work, prototypes, implementation, and nested workers. If the user-selected model is unavailable, record a durable orchestration blocker and ask for a replacement.

Provider bridges are **retired casts**: they report a successful spawn and then die silently minutes later, so a dead worker reads as a live one on the frontier and the map stalls behind it. Where a rubric, addendum, or ticket names one, use a runtime-native worker and record the substitution in the claim comment.

T3 threads cast per [`T3.md`](T3.md).

Review follows [`SHIP.md`](SHIP.md). Review calls are calls the worker waits on and that fail visibly, so the retired-cast rule binds workers, not review calls.

A conductor's cast binds only the worker it spawns, so restate **Casting** inside every worker prompt.

## Ship

An implementation ticket resolves when its code is **shipped**: a reviewed draft pull request, per [`SHIP.md`](SHIP.md). The human reads it, marks it ready for review, and has it merged through `babysit-pr`. The map's **Notes** are where an effort grants merge authority instead; then shipped means merged into `main`.

An implementation ticket whose blocker shipped as an open pull request builds on that pull request's branch, so the two form a stack.

**Throwaway stays throwaway.** A prototype or research ticket answers a question: its code and notes live on their own `prototype/<name>` or `research/<name>` branch behind a context pointer from the ticket, and `main` keeps only the decision they settled. Folding a validated decision into real code is an `implement` ticket, built fresh.

The worker earns its handoff through the proof gate and the review in [`SHIP.md`](SHIP.md). Anything it cannot prove there is a HITL park.

## Dispatch contract

- Fan out every unblocked, unclaimed non-grilling frontier ticket. If any grilling ticket is already open and claimed, dispatch no other grilling. Dispatch the next grilling only after the active one closes.
- Give every worker a wall-time cap and require a durable report before idle: its resolution, or the exact one question awaiting the human.
- Isolate parallel writers whose scopes could collide. Serialize shared-file work.
- Send a ticket's follow-up work, such as review fixes, to its existing worker instead of dispatching a new one.
- Reserve one of three map-level CodeRabbit slots before dispatching an `implement` ticket. Hold the slot through implementation and review; release it when the ticket is shipped or parked.
- Treat the tracker as semantic truth. Runtime workers and human-attention affordances are projections, never substitutes.
- Keep ordinary AFK work off the human's attention rail. A prototype or spec doing its AFK stretch is also background work until it parks.
- A HITL park is complete only when the ticket has a comment containing decisions locked plus one pending question, and `wayfinder:awaiting-human` is present.
- A HITL resolution is complete only when its durable handoff comment records the accepted answer and resulting artifacts, the ticket is closed, and `wayfinder:awaiting-human` is absent. Then retire its runtime worker from human attention as the matching runtime addendum specifies.

### Lane contract

1. State a wall-time cap before dispatch.
2. Dispatch only through a surface that guarantees a one-shot deadline wake allowing a durable report, or worker termination at the cap. After hard termination, mark the lane orphaned and reconcile its ticket comments, labels, assignment, and closure before re-dispatching or reaping it. If neither enforcement mode is available, record a durable orchestration blocker instead of dispatching.
3. On each conductor wake and before completion, health-check lanes whose last durable activity is older than 15 minutes; do not create a polling lane.
4. A lane reports durably before idle; no report means orphaned, not done. Reconcile durable ticket state before any redispatch.
5. Reap every lane before declaring the map complete.
6. The conductor owns waits as event/state transitions, never background pollers or chained blocking waits.
7. The map has exactly three CodeRabbit slots shared by its implementation lanes.

## Wake law

On any worker notification, read the tracker; never message the worker merely because it notified.

- **Closed** → verify the resolution, reconcile the runtime attention state, then re-query the frontier.
- **Open + `wayfinder:awaiting-human`** → parked HITL. Surface it once, then stay silent until the human acts.
- **Open + assigned, no awaiting label** → active, queued, or orphaned. Use the runtime addendum to distinguish them without interrogating the worker.
- **Invalidated by another resolution** → record why, stop or retire its runtime worker, clear its human-attention state, and update or close the ticket through Wayfinder's scope rules.

The ticket is durable state; a worker is a cache. Recovery starts from the map, ticket comments, assignment, labels, and recorded runtime locator.

## Conductor loop

1. Load the map's low-resolution body.
2. Query open child state and compute the unblocked, unclaimed frontier.
3. Dispatch per ticket type and runtime addendum.
4. On every tracker transition, reconcile attention state and dispatch newly unblocked work.
5. Graduate newly sharp fog into tickets. Keep the canonical decision lookup index on the map while preserving ticket comments as the durable evidence for each decision.

Done means **every in-scope ticket is closed, every implementation ticket is shipped, every dispatch setup and worker is terminal, and no runtime worker remains on the attention rail**. An empty frontier alone is not completion: claimed, blocked, and parked tickets are deliberately absent from it.
