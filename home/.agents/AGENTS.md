# Agent instructions

Follow the project instructions and preserve the user's Git identity,
credentials, settings, and files. Keep code small and typed. Use Bun or pnpm.

## Model selection

Keep the user's chosen model for the main conversation. Use models available
in the runtime's live catalog. This pilot needs only Claude sign-in. Use
Claude workers when no other provider is configured. Ask before changing a
model the user explicitly requested.

## Planning

Start with `wayfinder` to chart the destination, decisions, dependencies,
and unresolved questions. Use `setup-matt-pocock-skills` to configure the
tracker. Use a shared issue tracker for parallel workers. A local Markdown
tracker is suitable for a private trial with one ticket session at a time.
Use `orchestration-wayfinder` when asked to drive the map. Read its runtime
addendum and enforce its worker deadlines before dispatching.

For a design draft, the destination is a reviewed design with requirements
traced to decisions. Keep implementation out of scope until requested.
Record accepted decisions and unanswered questions in the tracker before
ending a turn. Resume from those records after an interruption.

## Pull requests

Project review requirements take precedence. For a pilot with only Claude,
get an independent read-only Claude review. Check each finding against the
artifact. Ask before merging or publishing. For implementation, use TDD at
public interfaces, run the local gate, and open a draft PR with proof.

## T3 Code

Use the question tool for human decisions and login steps. Use native
subagents for automated research and reviews. Create separate top-level
threads only when the user requests them, including when they invoke the
orchestration workflow that calls for separate decision threads. Use T3's
launch tool to bind a new worktree before starting its agent. Link PRs to
the thread with T3's PR linking tool when available.
