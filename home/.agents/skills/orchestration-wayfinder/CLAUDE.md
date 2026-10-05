# Orchestration Wayfinder — Claude Code runtime

Read this addendum only when Claude Code drives. [`SKILL.md`](SKILL.md) is the source of truth for tracker semantics and the conductor loop.

## Dispatch surfaces

- Dispatch through named background `Agent` workers. The fleet view is the human entry surface for HITL work.
- Fan out AFK work and prototype/spec AFK stretches. Keep grilling serial.
- Name each worker for its ticket and follow **Casting** in [`SKILL.md`](SKILL.md).
- Record the worker name and transcript path in the ticket's claim comment as soon as they are available.

Every worker prompt includes the wall-time cap, report-before-idle requirement, ticket claim, prescribed skill, durable park/resolution protocol, the rule that downstream dispatch belongs to the conductor, and **Casting** from [`SKILL.md`](SKILL.md).

An implementation worker's prompt also carries its ship terminal per [`SHIP.md`](SHIP.md): the proof bundle, the draft pull request, and its review.

## Human attention

Use the tracker and fleet view:

- Active AFK stretch → no human cue.
- Durable HITL park + `wayfinder:awaiting-human` → cue once with the worker name and exact decision. Record `<!-- orchestration-wayfinder-cue:claude:<worker-name> -->` on the ticket; that worker's marker suppresses repeat cues after compaction.
- Repeated wakes while parked → no relay and no worker message.
- Closed ticket → verify the durable handoff, retire the worker, and re-query the frontier.

## Process mortality

In-process workers do not survive a conductor resume. The ticket is durable; the worker is a cache.

On resume, sweep every open assigned child. A ticket whose latest locator says `Runtime: T3 Code` recovers through [`T3.md`](T3.md) instead:

- Live worker in the current conductor registry → leave it and its ticket unchanged.
- `wayfinder:awaiting-human` present and no live worker → create a successor. Give it the predecessor transcript and ticket park comments; it restates the pending question without re-asking answered ones.
- No awaiting label and no live worker → unassign and redispatch the AFK ticket.

Record each successor's locator on the ticket and cue its new park once. A worker notification only causes a tracker read; never message the worker merely because it notified.

When a ticket is invalidated, terminate its live worker, clear `wayfinder:awaiting-human`, record the invalidation, and retire it from the fleet view before advancing the frontier.
