"""Classify Tailscale Serve JSON on stdin for the Fleet routes on HTTPS port 60001.

Arguments name the handler paths that the caller needs. Print "ready" when all
of them exist, "missing" when some are absent and the rest of the configuration
belongs to Fleet or is a preview, and "conflict" for any other Serve or Funnel
configuration. A preview serves a local directory or a loopback port at its own
path, as `fleet preview` publishes it.
Print only the classification. Status can contain private node information.

With `--previews <base URL>`, print each preview's name, target, and link
instead.
"""
import json
import re
import sys

FLEET_HANDLERS = {
    "/": {"Proxy": "http://127.0.0.1:3773"},
    "/management.html": {"Proxy": "http://127.0.0.1:8317/management.html"},
    "/v0/management": {"Proxy": "http://127.0.0.1:8317/v0/management"},
    "/v1": {"Proxy": "http://127.0.0.1:8317/v1"},
}

PREVIEW_PATH = re.compile(r"^/[a-z0-9][a-z0-9-]*/$")
LOOPBACK_PORT = re.compile(r"^http://127\.0\.0\.1:[0-9]+$")


RESERVED_PREVIEW_PATHS = {"/v0/", "/v1/"}


def is_preview(path, handler):
    if not PREVIEW_PATH.match(path) or path in RESERVED_PREVIEW_PATHS:
        return False
    if set(handler) == {"Path"}:
        return handler["Path"].startswith("/")
    return set(handler) == {"Proxy"} and bool(LOOPBACK_PORT.match(handler["Proxy"]))


def belongs_to_fleet(path, handler):
    if path in FLEET_HANDLERS:
        return FLEET_HANDLERS[path] == handler
    return is_preview(path, handler)


def port_handlers(config):
    handlers = {}
    for host, value in config.get("Web", {}).items():
        if not host.endswith(":60001") or set(value) != {"Handlers"}:
            return None
        handlers.update(value["Handlers"])
    return handlers


def classify(config, needed_paths):
    handlers = port_handlers(config)
    valid = (
        set(config) <= {"TCP", "Web", "AllowFunnel"}
        and config.get("TCP", {}) in ({}, {"60001": {"HTTPS": True}})
        and len(config.get("Web", {})) <= 1
        and handlers is not None
        and all(belongs_to_fleet(path, value) for path, value in handlers.items())
        and not any(config.get("AllowFunnel", {}).values())
    )
    if not valid:
        return "conflict"
    return "ready" if all(path in handlers for path in needed_paths) else "missing"


def previews(config):
    handlers = port_handlers(config) or {}
    found = []
    for path, handler in sorted(handlers.items()):
        if path not in FLEET_HANDLERS and is_preview(path, handler):
            found.append((path.strip("/"), handler.get("Path") or handler["Proxy"]))
    return found


def print_previews(config, base_url):
    rows = [(name, target, f"{base_url}/{name}/") for name, target in previews(config)]
    if not rows:
        return
    name_width = max(len(row[0]) for row in rows)
    target_width = max(len(row[1]) for row in rows)
    for name, target, url in rows:
        print(f"{name:<{name_width}}  {target:<{target_width}}  {url}")


config = json.load(sys.stdin) or {}
if sys.argv[1:2] == ["--previews"]:
    print_previews(config, sys.argv[2])
else:
    print(classify(config, sys.argv[1:]))
