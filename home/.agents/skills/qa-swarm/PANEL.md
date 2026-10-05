# QA swarm panel

Use independent read-only native Claude subagents, one per lens. Choose a model from the runtime's live catalog. The user needs only the existing Claude login. Each reviewer gets the goal, diff, prior findings and one lens. At most two rounds. If the project requires a second model family, follow that requirement and report unavailable access.

## Brief

Every brief carries the same text and the full diff before its lens, so the
lanes share a prompt cache:

```md
You review a pull request. You did not write it. Review only: do not edit
files, commit, push, or post to GitHub.

Goal: <goal>
Base: origin/<base>. Head: <sha>. The diff is below.
Danger areas: <hunks>
Settled: <ledger entries that are fixed, rejected, or decided>. Raise one
again only when the code under it changed.

Read each changed hunk with its surrounding code, callers, and types before
you judge it. Report a finding only when you can name its concrete trigger and
its concrete consequence under intended use. When one cause breaks the same
rule at more than one site, report it once and list every site.

Style counts when it breaks a named standard: the repo's documented rules or
the Coding preferences in AGENTS.md. Taste without a standard is not a
finding.

End with:

FINDINGS:
- <file>:<line> | <blocker|major|minor|nit> | <lens> | <trigger> -> <consequence> | <fix> | sites: <file:line, ...>
(or "(none)")
COVERED: <every changed file you cleared or flagged>

You are done when every changed file is cleared or flagged against every
hunting ground of your lens.

<output of git diff origin/<base>...<sha>>

Lens: <lens name and hunting grounds>
```

## Lenses

Every panel runs every lens. **UI** runs only when the diff changes a user
interface.

### Fresh eyes

The Claude lane's second opinion on the whole change. Read it as a senior
engineer who sees it for the first time:

- Does the code do what the goal and the commits claim?
- Anything that looks wrong in any area: logic, edge cases, error handling,
  races, names, structure, or tests.
- The part of the change you would ask the author about first.

### Correctness

Does the code do what the goal asks, for every input it will meet? Then assume
it is wrong and find how it breaks.

- Trace one concrete input through each new branch. Look for results that are
  wrong but silent.
- Boundaries: empty, single, huge, malformed, duplicate, and off-by-one inputs.
- Data mapping between layers, type coercions, and state mutations.
- Queries: join and filter conditions, aggregation, deterministic ordering,
  transaction boundaries.
- Async: a missing await, blocking work on an async path, races on shared
  state.
- Error paths: what the caller sees when each dependency fails.
- Goal fit: every part of the goal done, and no behaviour the goal does not
  ask for.
- Malformed, huge, empty, or malicious input.
- A slow dependency, or one that returns garbage.
- Concurrent requests and retries.
- Production volume.
- Old and new code running side by side during the deploy.
- The next developer who extends the code in the obvious, wrong way.

### Risk

Is the change safe against a hostile caller, and does it hold up at real scale
and through a deploy?

Security: a finding names the source, the sink, the missing control, an
exploit request, and why it is reachable. Drop a finding that misses one of
them.

- Access control on every method and action of a changed endpoint,
  permissions that allow by default, tenant scoping (IDOR), and mass
  assignment through writable fields.
- Injection: SQL in values and identifiers, shell, SSRF and open redirects,
  path traversal, XSS sinks, template injection, prompt injection that reaches
  a tool or an output sink.
- Secrets and personal data in code, logs, error reports, or URLs.
- Authentication: token checks, constant-time comparison, OAuth state and
  redirect checks, sessions on credential change, webhook signatures.
- Expensive work before authentication, and unbounded limits from the caller.
- CI and dependencies: `pull_request_target` with the PR head, loose pins,
  new install scripts.

Defense in depth, missing headers, or rate limits without an exploit chain are
not findings.

Production:

- Performance: N+1 queries, a missing index on a new filter, unbounded loads,
  memory that grows with the input, missing pagination, unbounded date ranges.
- Migrations: lock type and duration, a reversible path, old and new code
  running side by side during the deploy, deploy order.
- Contracts: changed request or response shapes, serialized formats read by
  other services, cached data written in the old format.
- Reliability: timeouts, retries without a cap, missing idempotency on side
  effects, swallowed errors, cache invalidation on every serving path,
  cleanup of resources.
- Rollout: risky behaviour behind a feature flag, safe behaviour when the flag
  is off, manual deploy steps.
- Observability: logs or metrics where data is dropped or limited, and enough
  signal to see the change fail in production.

### Design

Is this the simplest code that meets the goal, and do the tests prove it?

- Simple design, in order: it passes the tests, reveals its intent, says each
  thing once, and has no superfluous parts.
- Removal first: every new branch, flag, fallback, alias, mode, or parameter
  that the goal does not need. The fix is to delete it.
- The Coding preferences in `AGENTS.md`: names and small methods that explain
  the code instead of comments, type safety, YAGNI.
- The smell baseline in step 3 of the `code-review` skill, and coupling:
  boolean parameters that make one function do two jobs, parallel arrays,
  circular dependencies.
- Naming: names that hide what a thing holds or does, negated booleans, stale
  copied names.
- Fit: the idioms, helpers, and patterns of the surrounding code.

Leave untouched lines alone, and leave short, clear code unextracted.

Tests:

- Behaviour through public seams, as the `tdd` skill defines them.
- A test for every behaviour the goal adds or changes, and for every fixed bug.
- Tautological tests, tests coupled to internals, mocks that differ from
  production, and smoke tests that prove nothing.
- Weakened or deleted assertions, skipped tests, and snapshots regenerated
  wholesale.
- Flaky constructs: real time, randomness, ordering, shared state between
  tests.
- Repeated test bodies that want one parameterized test.

### UI

Does the screen behave well for a real user?

- Loading, empty, and error states for every async action. An error state
  shows the real error.
- Visible feedback for every click, and a confirmation before a delete.
- Validation on the client and the server.
- Accessibility: labels, focus, and keyboard use, including IME composition
  before Enter submits.
- Overflow and truncation of dynamic text.
- Copy: clear, consistent wording for the same concept, and a permission
  error that names the missing permission.
