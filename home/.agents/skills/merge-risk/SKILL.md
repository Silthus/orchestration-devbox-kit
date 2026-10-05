---
name: merge-risk
description: >-
  Grade a PR's merge risk, its blast radius, as low, medium, or high, count
  its lines by kind, and post both to the PR description. Use when
  qa-swarm or review-pr reach their risk step, or when the user asks how risky
  or how big a PR is to merge.
---

# Merge risk

The **merge risk** is the blast radius of merging a diff: what breaks, for
whom, and what limits it. Grade only the PR's own increment: in a stack, the
diff against its parent PR.

## Danger areas

Hunks that touch authentication, permissions, secrets or crypto, billing or
real sends to customers, migrations or schema, destructive writes, data
ingestion, locking or concurrency, public API contracts, dependencies, or
deploy and CI configuration.

## Grade

Read every danger hunk with its callers. Danger areas and over about 400
production lines in the line count raise the grade. A default-off feature flag, focused
tests on the risky path, and a clean revert lower it. Done when every danger
hunk is named and the grade follows from them.

## Line count

The **line count** shows how much of the diff a reviewer must read. Count
each file from `git diff --numstat <remote>/<base>...HEAD` and put it in the
first kind that fits:

1. **Generated**: lock files, snapshots, vendored code, binaries, files that
   `git check-attr linguist-generated` marks, and files whose header says they
   are generated.
2. **Tests**: tests, fixtures, and test helpers.
3. **Evals**: eval suites, datasets, and graders.
4. **Docs**: prose documentation, such as Markdown outside the code.
5. **Production**: everything else, including config, CI, and migrations.

Show Production and Total always, and the other kinds when they have files.
Done when every changed file sits in one row and Total matches the diff.

```markdown
<!-- line-count -->
| Kind | Files | Lines |
| --- | ---: | ---: |
| **Production** | 6 | +284 −41 |
| Tests | 4 | +512 −3 |
| Docs | 2 | +40 −12 |
| Generated | 3 | +2,140 −1,020 |
| Total | 15 | +2,976 −1,076 |
<!-- /line-count -->
```

## Callout

Name the concrete risk and what limits it, in one to three bullets. The grade
sets the circle and the callout colour:

| Grade  | Circle | Callout       |
| ------ | ------ | ------------- |
| low    | 🔵     | `[!NOTE]`     |
| medium | 🟡     | `[!WARNING]`  |
| high   | 🔴     | `[!CAUTION]`  |

```markdown
<!-- merge-risk -->
> [!WARNING]
> 🟡 **Merge risk: medium** (merge-risk rubric)
> - <the concrete risk: the path, what could break, for whom>
> - <what limits it: the flag, the tests, the revert>
<!-- /merge-risk -->
```

GitHub fixes the callout's title and strips `class` and `style` from HTML, so
the circle and the bold grade line inside the callout carry the risk.

## Post

Write both blocks to the PR description, so a reviewer reads the problem,
then the risk, then the change with its size. On a PR by someone else, show
the blocks and post them after the user approves them.

1. Read the body with `gh pr view <n> --json body -q .body`.
2. Remove both marker blocks wherever they sit.
3. Put the callout right after the problem section, and the line count first
   in the changes section, under its heading. When the body has neither
   section, put the callout first and the line count under it. Keep the rest
   of the body byte for byte.
4. Write it back with `gh pr edit <n> --body-file <file>`.

Done when the description carries one block of each, in place, with the
current grade and line count.
