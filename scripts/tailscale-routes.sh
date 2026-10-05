#!/bin/sh
# Keep Tailscale subnet routes off on a Coder workspace. The tailnet advertises the
# workspace VPC, so accepted routes send Coder traffic into the tailnet and cut off the
# Coder agent. hogli devbox commands turn them on again, so cron checks every 5 minutes.
set -eu

usage='Usage: tailscale-routes.sh [plan|install|doctor|run]'
mode=${1:-plan}
[ "$#" -le 1 ] || { echo "$usage" >&2; exit 2; }
case "$mode" in plan|install|doctor|run) ;; *) echo "$usage" >&2; exit 2 ;; esac
fail() { echo "Tailscale routes: $*" >&2; exit 1; }
[ "$(uname -s)" = Linux ] || fail 'Only Linux workspaces need this.'
root=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd -P)
PATH="$PATH:/usr/local/bin:/usr/bin:/bin"
export PATH
begin='# BEGIN FLEET TAILSCALE ROUTES'
end='# END FLEET TAILSCALE ROUTES'

accepts_routes() {
  tailscale debug prefs 2>/dev/null | python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("RouteAll") else 1)' 2>/dev/null
}
turn_off_routes() {
  command -v tailscale >/dev/null 2>&1 || return 0
  accepts_routes || return 0
  sudo -n tailscale set --accept-routes=false || fail 'Cannot turn off subnet routes. Run sudo tailscale set --accept-routes=false.'
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) Tailscale routes: turned subnet routes off."
}

if [ "$mode" = run ]; then
  turn_off_routes
  exit 0
fi

# Cron treats % as a line break, and the entry quotes the path with single quotes.
case "$root" in *%*|*\'*) fail "Move the Fleet checkout to a path without % or ': $root" ;; esac
log="${XDG_STATE_HOME:-$HOME/.local/state}/fleet/tailscale-routes.log"
block() {
  printf '%s\n' "$begin"
  printf '%s\n' '# Managed by Fleet. Edit scripts/tailscale-routes.sh instead.'
  printf "*/5 * * * * sh '%s/scripts/tailscale-routes.sh' run >> '%s' 2>&1\n" "$root" "$log"
  printf '%s\n' "$end"
}
current() { crontab -l 2>/dev/null || true; }
installed() { current | sed -n "/^$begin\$/,/^$end\$/p"; }

if [ "$mode" = plan ]; then
  echo 'Tailscale routes plan (no changes):'
  echo '  Run sudo tailscale set --accept-routes=false when Tailscale accepts subnet routes.'
  echo '  Write this block into the user crontab and keep every other line:'
  block | sed 's/^/    /'
  exit 0
fi

command -v crontab >/dev/null 2>&1 || fail 'Install cron first.'

if [ "$mode" = install ]; then
  turn_off_routes
  wanted=$(block)
  if [ "$(installed)" != "$wanted" ]; then
    mkdir -p "$(dirname "$log")"
    # Read the whole table before writing it back.
    others=$(current | sed "/^$begin\$/,/^$end\$/d")
    { [ -z "$others" ] || printf '%s\n' "$others"; printf '%s\n' "$wanted"; } | crontab -
    echo 'Tailscale routes: cron entry written.'
  fi
fi

[ "$(installed)" = "$(block)" ] || fail 'The cron entry is missing or changed. Run sh scripts/tailscale-routes.sh install.'
pgrep -x cron >/dev/null 2>&1 || pgrep -x crond >/dev/null 2>&1 || fail 'The cron daemon is not running, so the entry never runs.'
if command -v tailscale >/dev/null 2>&1 && accepts_routes; then fail 'Tailscale accepts subnet routes. Run sh scripts/tailscale-routes.sh run.'; fi
echo 'Tailscale routes: subnet routes stay off. Cron checks every 5 minutes.'
