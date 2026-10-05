#!/bin/sh
# Set up the native T3 service and private HTTPS access on an opted-in Linux host.
set -eu

mode=${1:-plan}
[ "$#" -le 1 ] || { echo 'Usage: t3-headless.sh [plan|install|doctor]' >&2; exit 2; }
case "$mode" in plan|install|doctor) ;; *) echo 'Usage: t3-headless.sh [plan|install|doctor]' >&2; exit 2 ;; esac
fail() { echo "T3 headless: $*" >&2; exit 1; }
script_dir=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd -P)
[ "$(uname -s)" = Linux ] || fail 'Linux with systemd is required.'
user_id=$(id -u)
[ "$user_id" != 0 ] || fail 'Run as the user who will run T3, not root.'
user_name=$(id -un)
PATH="$HOME/.local/bin:$HOME/.bun/bin:$PATH"
export PATH
export XDG_RUNTIME_DIR="/run/user/$user_id"
export DBUS_SESSION_BUS_ADDRESS="unix:path=$XDG_RUNTIME_DIR/bus"
unit="$HOME/.config/systemd/user/t3code.service"
drop_in="$unit.d/fleet.conf"
marker="$HOME/.config/fleet/t3-headless.enabled"
service_path="$HOME/.local/bin:$HOME/.bun/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin"

# Reject linked parents before writing user configuration.
check_path() {
  checked=$1
  while [ "$checked" != "$HOME" ]; do
    [ ! -L "$checked" ] || fail "Keep linked path: $checked. Resolve it before install."
    if [ "$checked" != "$1" ] && [ -e "$checked" ] && [ ! -d "$checked" ]; then
      fail "Parent is not a directory: $checked"
    fi
    checked=$(dirname "$checked")
  done
}

drop_in_content() {
  # systemd expands % specifiers, including inside quoted environment values.
  escaped_service_path=$(printf '%s' "$service_path" | sed 's/\\/\\\\/g; s/"/\\"/g; s/%/%%/g')
  printf '[Service]\nEnvironment=T3CODE_HOST=127.0.0.1\nEnvironment=T3CODE_PORT=3773\nEnvironment="PATH=%s"\n' "$escaped_service_path"
}

for command_name in systemctl loginctl curl python3 ss; do
  command -v "$command_name" >/dev/null 2>&1 || fail "Install $command_name first."
done
systemctl show --property=Version --value >/dev/null 2>&1 || fail 'systemd must run as the system service manager.'
check_path "$drop_in"
check_path "$unit"
check_path "$marker"
if [ -e "$drop_in" ]; then
  [ -f "$drop_in" ] && drop_in_content | cmp -s - "$drop_in" || fail "Keep local file: $drop_in. Resolve it before install."
fi
if [ -e "$marker" ]; then
  [ -f "$marker" ] && [ "$(cat "$marker")" = 1 ] || fail "Keep local file: $marker. Resolve it before install."
fi

# Print only a classification. Status can contain private node information.
tailscale_running() {
  tailscale status --json 2>/dev/null | python3 -c 'import json,sys; sys.exit(0 if json.load(sys.stdin).get("BackendState") == "Running" else 1)' 2>/dev/null
}
serve_state() {
  sudo -n tailscale serve status --json | python3 "$script_dir/tailscale-serve.py" /
}
check_serve() {
  current_serve=$(serve_state) || fail 'Cannot read Tailscale Serve configuration. Run sudo tailscale serve status.'
  [ "$current_serve" != conflict ] || fail 'Keep existing Tailscale Serve or Funnel configuration. Resolve it before install.'
}
codex_command() {
  PATH="$service_path" command -v codex
}
codex_ready() {
  codex_path=$(codex_command) || return 1
  "$codex_path" app-server --help >/dev/null 2>&1
}

if [ "$mode" = plan ]; then
  echo 'T3 headless plan (no changes):'
  command -v tailscale >/dev/null 2>&1 || echo '  Install Tailscale first. See https://tailscale.com/docs/install/linux.'
  command -v t3 >/dev/null 2>&1 || echo '  Install the latest nightly T3 Code with https://t3.codes/install.sh.'
  codex_ready || echo '  Install Codex CLI with https://chatgpt.com/codex/install.sh.'
  echo "  Write $drop_in with:"
  drop_in_content
  echo "  Write $marker with: 1"
  echo "  Enable tailscaled and user linger for $user_name."
  echo "  Start user@$user_id.service."
  if [ ! -e "$unit" ]; then echo '  Run t3 service install.'; fi
  echo '  Enable and start t3code.service. Restart only if the drop-in is new.'
  echo '  After Tailscale login, set private HTTPS with:'
  echo '  sudo tailscale serve --bg --yes --https=60001 http://127.0.0.1:3773'
  echo '  Keep any existing differing Serve or Funnel configuration.'
  exit 0
fi

command -v tailscale >/dev/null 2>&1 || fail 'Install Tailscale first. See https://tailscale.com/docs/install/linux.'
command -v sudo >/dev/null 2>&1 || fail 'Install sudo first.'
sudo -n true || fail 'Password-free sudo is required for this setup.'

if [ "$mode" = install ]; then
  if command -v tailscale >/dev/null 2>&1; then
    # A stopped daemon has no readable configuration. Read it after startup.
    if systemctl is-active --quiet tailscaled; then check_serve; fi
  fi
  if ! command -v t3 >/dev/null 2>&1 || ! codex_ready; then
    download=$(mktemp)
    trap 'rm -f "$download"' EXIT HUP INT TERM
    if ! command -v t3 >/dev/null 2>&1; then
      curl -fsSL https://t3.codes/install.sh -o "$download"
      T3CODE_CHANNEL=nightly sh "$download"
    fi
    if ! codex_ready; then
      curl -fsSL https://chatgpt.com/codex/install.sh -o "$download"
      CODEX_NON_INTERACTIVE=1 CODEX_INSTALL_DIR="$HOME/.local/bin" sh "$download"
    fi
  fi
  command -v t3 >/dev/null 2>&1 || fail 'T3 installation did not provide t3 on PATH.'
  codex_ready || fail 'Codex CLI is missing or cannot start app-server. Resolve the existing installation, then run this command again.'
  sudo -n systemctl enable --now tailscaled
  check_serve
  sudo -n loginctl enable-linger "$user_name"
  sudo -n systemctl start "user@$user_id.service"
  changed=0
  if [ ! -f "$drop_in" ]; then
    mkdir -p "$(dirname "$drop_in")"
    drop_in_content > "$drop_in"
    changed=1
  fi
  mkdir -p "$(dirname "$marker")"
  printf '1\n' > "$marker"
  systemctl --user daemon-reload
  if [ ! -e "$unit" ]; then
    # Native startup can print a browser pairing token. Keep it out of install logs.
    t3 service install >/dev/null 2>&1 || fail 'T3 service install failed. Run t3 service install to inspect it.'
  elif [ "$changed" = 1 ]; then
    systemctl --user restart t3code.service
  fi
  systemctl --user enable --now t3code.service
  if ! tailscale_running; then
    fail 'T3 starts at boot. Next steps: run sudo tailscale up, then run this install command again.'
  fi
  check_serve
  if [ "$current_serve" = missing ]; then
    sudo -n tailscale serve --bg --yes --https=60001 http://127.0.0.1:3773
  fi
fi

command -v t3 >/dev/null 2>&1 || fail 'T3 is missing. Run the headless install command.'
command -v tailscale >/dev/null 2>&1 || fail 'Tailscale is missing. Run the headless install command.'
codex_ready || fail 'Codex CLI is missing or cannot start app-server. Run the headless install command.'
[ -f "$drop_in" ] && [ -f "$marker" ] || fail 'Headless setup is incomplete. Run the headless install command.'
systemctl is-enabled --quiet tailscaled || fail 'tailscaled is not enabled.'
systemctl is-active --quiet tailscaled || fail 'tailscaled is not running.'
[ "$(loginctl show-user "$user_name" --property=Linger --value)" = yes ] || fail 'User linger is not enabled.'
systemctl --user is-enabled --quiet t3code.service || fail 'T3 is not enabled.'
systemctl --user is-active --quiet t3code.service || fail 'T3 is not running.'
systemctl --user show t3code.service --property=Environment --value | python3 -c '
import shlex,sys
env=dict(item.split("=",1) for item in shlex.split(sys.stdin.read()) if "=" in item)
sys.exit(0 if env.get("T3CODE_HOST") == "127.0.0.1" and env.get("T3CODE_PORT") == "3773" else 1)
' || fail 'Another service setting overrides the T3 loopback address or port.'
curl --fail --silent --max-time 10 --retry 5 --retry-connrefused --retry-delay 1 http://127.0.0.1:3773/.well-known/t3/environment | python3 -c '
import json,sys
descriptor=json.load(sys.stdin)
sys.exit(0 if isinstance(descriptor.get("environmentId"), str) and isinstance(descriptor.get("serverVersion"), str) else 1)
' 2>/dev/null || fail 'T3 does not respond on 127.0.0.1:3773.'
ss -H -ltn 'sport = :3773' | python3 -c '
import sys
listeners=[line.split() for line in sys.stdin if line.strip()]
sys.exit(0 if listeners and all(len(fields) >= 4 and fields[3] == "127.0.0.1:3773" for fields in listeners) else 1)
' || fail 'Port 3773 must listen only on 127.0.0.1.'
tailscale_running || fail 'Next steps: run sudo tailscale up, then run the headless install command again.'
check_serve
[ "$current_serve" = ready ] || fail 'Tailscale Serve is not configured. Run the headless install command.'
codex_path=$(codex_command) || fail 'Codex CLI is missing from the T3 service PATH.'
# Codex that uses the Fleet CLI proxy needs no sign-in of its own.
if [ "$mode" = install ] && ! grep -qx 'model_provider = "fleet-proxy"' "$HOME/.codex/config.toml" 2>/dev/null && ! "$codex_path" login status >/dev/null 2>&1; then
  echo 'T3 headless: Codex CLI needs sign-in. Run codex login --device-auth.'
fi
echo 'T3 headless: service, boot startup, and private Tailscale HTTPS are ready.'
