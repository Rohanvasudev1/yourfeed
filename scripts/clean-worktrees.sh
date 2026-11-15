#!/usr/bin/env bash
# Remove worktrees whose work is finished: their pull request is merged or closed.
# Never removes a worktree with
# uncommitted changes. Usage: scripts/clean-worktrees.sh [--dry-run]
set -euo pipefail

DRY_RUN=false
[[ "${1:-}" == "--dry-run" ]] && DRY_RUN=true

REPO_ROOT="$(git rev-parse --show-toplevel)"
MAIN_WORKTREE="$(git worktree list --porcelain | awk '/^worktree /{print $2; exit}')"
git fetch --quiet --prune origin || echo "warning: couldn't fetch origin; using local refs" >&2

# Only a merged or closed pull request counts as finished. "Branch is an ancestor of
# main" is not enough: a freshly created worktree with no commits passes that check.
is_finished() {
  local branch="$1"
  command -v gh >/dev/null || return 1
  local state
  state="$(gh pr list --head "$branch" --state all --json state --jq '.[0].state' 2>/dev/null || true)"
  [[ "$state" == "MERGED" || "$state" == "CLOSED" ]]
}

removed=0 kept=0
while read -r path branch; do
  [[ "$path" == "$MAIN_WORKTREE" || -z "$branch" ]] && continue
  if [[ ! -d "$path" ]]; then continue; fi
  if [[ -n "$(git -C "$path" status --porcelain)" ]]; then
    echo "keep   $path ($branch): uncommitted changes"; kept=$((kept + 1)); continue
  fi
  if ! is_finished "$branch"; then
    echo "keep   $path ($branch): not merged or closed yet"; kept=$((kept + 1)); continue
  fi
  echo "remove $path ($branch)"
  if ! $DRY_RUN; then
    git worktree remove "$path"
    git branch -D "$branch" >/dev/null 2>&1 || echo "  note: couldn't delete branch $branch" >&2
  fi
  removed=$((removed + 1))
done < <(git -C "$REPO_ROOT" worktree list --porcelain | awk '
  /^worktree /{p=$2} /^branch /{sub("refs/heads/","",$2); print p, $2} /^detached/{print p, ""}')

$DRY_RUN || git worktree prune
echo "done: $removed removed, $kept kept$($DRY_RUN && echo ' (dry run)')"
