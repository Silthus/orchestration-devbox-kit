# Orchestration Wayfinder — shipping an implementation ticket

Read this before the handoff. [`SKILL.md`](SKILL.md) owns _when_ a ticket ships; this file owns what earns the handoff.

## Proof bundle

Every claim is an artifact linked from the ticket, never a sentence:

- **red** — the test that reproduces the bug or expresses the missing behaviour, failing on the tree before the change;
- **green** — that same test passing after it, every assertion intact and no test skipped;
- the repo's full local gate green on the final tree;
- for any user-facing surface, a screenshot or recording of the behaviour in the running app.

An artifact the worker cannot produce is a park, recorded as the one pending question for the human.

## Review

Open the draft pull request with the proof bundle in its description, and review it the way **Pull requests** in `AGENTS.md` prescribes: an independent read-only review with an available model, or the review required by the repository's `AGENTS.md`. The reviewer never saw the build, so the builder never reviews its own work.

A review that leaves a decision open is a park: decisions locked plus the one pending question. The ticket stays parked until the human answers; more review rounds never unpark it, so the conductor never re-dispatches a worker to keep reviewing.

## Handoff

The terminal is the reviewed draft pull request with every finding fixed or rejected. The worker links the pull request in the resolution comment with the reviewed head, the proof, the calls made, and the follow-ups. Then it closes the ticket. The conductor graduates the follow-ups into tickets.

## Merge, when the map grants it

When the map's **Notes** grant merge authority, the worker drives the pull request to merged after the handoff, following the repo's prescribed ship-to-main procedure and whatever main-safety gate that repo defines. The terminal is then a merged commit: the worker links it in the resolution comment and closes the ticket on it. A red gate is reported on the ticket and parked rather than merged past.
