---
name: share-preview
description: Share a running app or static build from a devbox through private Tailscale HTTPS.
---

# Share a preview

Use T3's native preview to inspect a page during the session. For a link the
human can open, use the box's existing private HTTPS listener on port 60001.

1. Choose a short lowercase preview name. Read `tailscale serve status`
   and choose an unused path. Preserve the T3 route at `/` and other previews.
2. Start the app on a free loopback port. For a static build, use
   `python3 -m http.server <port> --bind 127.0.0.1 --directory <build-dir>`.
   Run it with `systemd-run --user --unit=preview-<name>` so it survives a
   session disconnect. Use the app's own server for a development build.
3. Configure relative asset URLs or the base path `/<name>/`.
4. Publish with `sudo tailscale serve --bg --https=60001
   --set-path=/<name> http://127.0.0.1:<port>`.
5. Verify the page and an asset through the private HTTPS address. Give the
   user `https://<box>.<tailnet>.ts.net:60001/<name>/` after verification.

Remove only this preview with `sudo tailscale serve --https=60001
--set-path=/<name> off`, then stop `preview-<name>` with `systemctl --user`.
Preserve the T3 listener, other routes, and tailnet policy.
