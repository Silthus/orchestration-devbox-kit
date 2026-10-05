#!/bin/sh
set -eu
mode=${1:?Usage: configure-issue-repo.sh validate <owner/repo> | install <project> <owner/repo>}
case "$mode" in
  validate) issue_repo=${2:?Issue repository is required} ;;
  install) project=${2:?Project path is required}; issue_repo=${3:?Issue repository is required} ;;
  *) exit 2 ;;
esac
issue_repo=${issue_repo%.git}
printf '%s\n' "$issue_repo" | LC_ALL=C grep -Eq '^[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9][A-Za-z0-9_.-]*$' || {
  echo 'Enter the issue repository as owner/repo.' >&2
  exit 1
}
case "$(printf '%s' "$issue_repo" | tr '[:upper:]' '[:lower:]')" in
  posthog/posthog|posthog/posthog.git)
    echo 'Do not use the public PostHog/posthog repository: orchestration creates many issues. Choose a dedicated repository you own, preferably private.' >&2
    exit 1
    ;;
esac
if [ "$mode" = validate ]; then printf '%s\n' "$issue_repo"; exit 0; fi
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
project=$(CDPATH= cd -- "$project" && pwd -P)
home_root=$(CDPATH= cd -- "$HOME" && pwd -P)
source_repo=$(git -C "$project" remote get-url origin | sed -e 's#^https://github.com/##' -e 's#^git@github.com:##' -e 's#\.git$##')
printf '%s\n' "$source_repo" | LC_ALL=C grep -Eq '^[A-Za-z0-9][A-Za-z0-9-]*/[A-Za-z0-9][A-Za-z0-9_.-]*$' || {
  echo 'The code checkout must have a GitHub HTTPS or SSH origin without embedded credentials.' >&2; exit 1
}
tracker="$project/docs/agents/issue-tracker.md"
rule="$home_root/.claude/rules/orchestration-issues.md"
work=$(mktemp -d)
trap 'rm -rf "$work"' EXIT HUP INT TERM
{
  printf '# Selected design issue repository\n\nIssue repository: `%s`. Code repository: `%s`.\n\n' "$issue_repo" "$source_repo"
  printf 'Use this selected issue repository for design maps, tickets, labels, comments, and dependencies. Keep pull requests in the code repository. Do not create design issues in PostHog/posthog.\n\n'
  sed -E -e "s#gh issue ([a-z-]+)#gh issue \1 --repo $issue_repo#g" \
    -e "s#repos/<owner>/<repo>/#repos/$issue_repo/#g" \
    -e "s#Infer the repo from.*#Always use --repo $issue_repo for issue commands. Do not infer the issue repository from the code checkout.#" \
    "$root/home/.agents/skills/setup-matt-pocock-skills/issue-tracker-github.md"
} > "$work/tracker"
{
  printf '# Orchestration issue repository\n\n'
  printf 'For wayfinder and orchestration design work whose code repository identifies as `%s` on GitHub, the selected issue repository is `%s`. This choice applies in every worktree of that code repository.\n\n' "$source_repo" "$issue_repo"
  printf 'Read docs/agents/issue-tracker.md when present. Preserve the selected repository when configuring the tracker. For issue commands, always pass --repo %s. For issue REST operations, use repos/%s/. Keep pull requests tied to the code repository.\n\n' "$issue_repo" "$issue_repo"
  printf 'Orchestration creates many issues. Do not create its design tickets in the public PostHog/posthog repository. If the selected issue repository is inaccessible, stop and ask the user. Never fall back to the code repository.\n'
} > "$work/rule"
check_target() {
  target=$1
  boundary=$2
  wanted=$3
  parent=$target
  while [ "$parent" != "$boundary" ]; do
    [ ! -L "$parent" ] && { [ ! -e "$parent" ] || [ -d "$parent" ] || [ "$parent" = "$target" ]; } || {
      echo "Keep linked or non-directory path: $parent" >&2; exit 1
    }
    parent=$(dirname "$parent")
  done
  if [ -e "$target" ]; then
    [ -f "$target" ] && cmp -s "$wanted" "$target" || { echo "Keep existing tracker choice: $target. Review it before changing the issue repository." >&2; exit 1; }
  fi
}
check_target "$tracker" "$project" "$work/tracker"
check_target "$rule" "$home_root" "$work/rule"
mkdir -p "$(dirname "$tracker")" "$(dirname "$rule")"
[ -f "$tracker" ] || cp "$work/tracker" "$tracker"
[ -f "$rule" ] || cp "$work/rule" "$rule"
printf 'Design issues are configured for %s. No issues were created.\n' "$issue_repo"
