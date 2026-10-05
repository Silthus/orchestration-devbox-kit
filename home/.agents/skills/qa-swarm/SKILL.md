---
name: qa-swarm
description: >-
  Bring a PR to review-ready: a cross-model reviewer panel, a fix for every
  verified finding and bot thread, in at most two rounds. Use when the user
  asks for a QA swarm, or when the diff touches a merge-risk danger area.
---

# QA swarm

The swarm takes a branch to a draft PR that the user can merge after one read.
The bar: the user finds nothing that a reviewer, a review bot, or CI would have
found. Fresh reviewers on two model families review the change, you fix what
holds, and a second, narrow round reviews your fixes. Two rounds is the
budget: a third panel costs as much as the first and mostly finds churn.

## Rules

- **Fresh eyes.** The agent that built the change never reviews it. Every
  reviewer is a new agent that did not see the build. You frame, triage, and
  fix. A fix you push is new code, and the next round reviews it cold.
- **Two model families.** Every panel runs the Claude lane and the GPT lane.
  They miss different things. A finding from both carries more weight.
- **Claims are hypotheses.** Check every finding against the code at HEAD
  before you act on it, whoever raised it.
- **Observe.** Proof is something you ran and watched, never an argument that
  the code works.
- **Scope.** The PR's goal is the scope. A real problem outside it is a
  follow-up for the handoff.
- **Draft.** the user marks the PR ready for review himself. Leave the draft
  state to him.
- **Comments.** The swarm's findings stay in the ledger, not on GitHub. Every
  GitHub comment goes through the `leaving-pr-comments` skill.

## 1. Frame

Fetch the base branch, then write down:

- **Goal**: what the user asked for, in one or two sentences, and the issue it
  closes. The goal is the oracle: behaviour it does not ask for gets extra
  scrutiny.
- **Base** and the diff, `git diff origin/<base>...HEAD`.
- **Danger areas**: the hunks in the danger areas of the `merge-risk` skill.
- **Split**: one concern per PR, at most about 400 production lines in the
  `merge-risk` line count. Split a larger or mixed change into a stack before
  the first round. Each PR builds only on the PRs below it and carries its
  own tests. Run the swarm on each PR, bottom up.

Done when the goal, base, danger areas, and split are written down.

## 2. Open the draft

1. Run the repo's local gate: its formatter, lint, typecheck, and tests. Find
   them in the repo's agent docs, scripts, and CI configuration. Done when the
   gate is green.
2. Push. When no PR exists, open a draft with `gh pr create --draft`. Write
   the description in the user's voice from the `writing-voice` skill, in the
   repo's PR template when it has one. It states the problem, the change, the
   test seams, the danger areas, and how to verify the change: a command and
   the output to expect.
3. Start the ledger at `$(git rev-parse --git-dir)/qa-swarm/<pr>.md`. It holds
   every finding, thread, and check failure with its source, location, bucket,
   and evidence. It survives a context compaction and stays out of the
   history.

Done when the PR exists and its head is your HEAD.

## 3. Rounds

A round works on one HEAD. Run its steps in order.

1. **Review.** Read [`PANEL.md`](PANEL.md) and dispatch the panel on HEAD.
   While it runs, wait until the review bots of the repo's recent PRs have
   reviewed HEAD and the **gating checks** on HEAD have finished. The gating
   checks are the required checks (`gh pr checks --required`), or every check
   when the repo marks none as required. Wait at most 15 minutes and record a
   bot that stays silent.
2. **Triage** every panel finding, unresolved review thread, bot comment on
   HEAD, and failed check per [`TRIAGE.md`](TRIAGE.md). Done when each one is
   in the ledger with exactly one bucket.
3. **Fix** every fix and call item. Fix a bug red first with the `tdd` skill:
   a test that fails on the bug, then the fix. Close the sibling sites a
   finding names in the same commit. Run the local gate, commit, and push.
   Then answer the threads as TRIAGE.md says.

The round is clean when it produced no fix or call item. A clean first round
ends the rounds.

After a first round with fixes, run the second round on the new HEAD. It is
narrow: its panel runs only the lenses whose findings you fixed, and their
briefs carry the fix diff, `git diff <round 1 head>...HEAD`, in place of the
full diff. When every fix only renamed, reworded, or reformatted code, the
second round skips the panel and waits for the bots and checks only.

The second round is the last. Fix what it finds and push without another
panel; the bots and checks on that HEAD review the fix. A fix item you cannot
close becomes a decision, and the handoff is blocked.

Done when every ledger item is fixed, rejected, or a decision, and every
gating check on HEAD is green. A check that has not reported yet is not green. A repo without CI relies on the
local gate; name that as a gap. A check that waits for a maintainer to approve
the run is a gap too, not a failure.

## 4. Prove

1. Run the change and watch it work. Run the verify command from the
   description and keep its real output. Send a real request to a changed
   API. For a UI change, take a screenshot or a recording of the running app
   with the `agent-browser` skill.
2. A failed proof is a fix item: go back to the rounds.
3. Put the proof in the PR description and update the description so that it
   matches the final diff.
4. Grade the merge risk of the final diff with the `merge-risk` skill, and
   post its callout and line count.

Behaviour that only production can show is a gap for the handoff. Done when
the description carries the proof and a merge risk that matches the final
diff.

## 5. Hand off

Report to the user, then stop:

- The PR link and its outcome. **Ready**: every ledger item is fixed or
  rejected on `<short sha>`, the gating checks are green, and no decision is
  open. **Blocked**: anything else, with what blocks it: the open decisions or
  a red check.
- The merge risk and its first bullet.
- The rounds, and the number of fixed and rejected items per source.
- **Decisions**: each load-bearing question with your recommended answer.
- **Calls made**: each choice between defensible options, with the
  alternative, so that the user can redirect it in one line.
- **Drafts**: each reply that needs the user's approval, with its thread URL.
- **Read first**: the danger hunks.
- **Follow-ups**: real problems outside the goal.
- **Gaps**: a lane that failed and its substitute, a silent bot, a proof you
  could not run.

End with the Slack message that `AGENTS.md` asks for at the end of a PR.
the user reads the code and marks the PR ready for review. When he asks you to
babysit it, the `babysit-pr` skill takes over.
