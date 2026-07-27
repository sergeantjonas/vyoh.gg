# Nginx configuration

Host-installed Nginx is the only ingress on the VPS. Both containers bind
`127.0.0.1` and are unreachable from outside the box, so everything below is
about getting requests from :443 to a loopback port.

Layout follows the multi-site convention in
[hosting.md](../../docs/working-notes/ops/hosting.md#per-component-conventions):
one file per project in `sites-available/`, symlinked into `sites-enabled/`.

```
deploy/nginx/vyoh-cache.conf   → /etc/nginx/conf.d/vyoh-cache.conf
deploy/nginx/vyoh.gg.conf      → /etc/nginx/sites-available/vyoh.gg.conf
deploy/nginx/api.vyoh.gg.conf  → /etc/nginx/sites-available/api.vyoh.gg.conf
```

`vyoh-cache.conf` is separate because `proxy_cache_path` is an `http`-context
directive and cannot live inside a `server` block.

## Install

```sh
sudo cp deploy/nginx/vyoh-cache.conf /etc/nginx/conf.d/
sudo cp deploy/nginx/vyoh.gg.conf deploy/nginx/api.vyoh.gg.conf /etc/nginx/sites-available/
sudo ln -sf /etc/nginx/sites-available/vyoh.gg.conf /etc/nginx/sites-enabled/
sudo ln -sf /etc/nginx/sites-available/api.vyoh.gg.conf /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## TLS

**These files are plain HTTP on purpose.** A config that references
`/etc/letsencrypt/live/vyoh.gg/fullchain.pem` before the certificate exists
makes `nginx -t` fail and `systemctl reload` refuse, which is a bad state to
discover during a first deploy. Install them as-is, point DNS at the box, then:

```sh
sudo certbot --nginx -d vyoh.gg -d www.vyoh.gg -d api.vyoh.gg
```

Certbot rewrites both files in place: it adds the `listen 443 ssl` blocks, the
`ssl_certificate` lines, and a permanent redirect from :80. Renewal runs from
the bundled `certbot.timer`; no cron entry is needed.

After that, `X-Forwarded-Proto` starts arriving as `https`, which is what the
web tier builds its request URLs from (`requestOrigin` in
[node-adapter.ts](../../apps/web/server/node-adapter.ts)).

## Why `vyoh.gg` is a proxy and not a static root

It used to be a static root, and hosting.md still describes that shape for
genuinely static sites on the same box. It stopped applying to vyoh.gg when the
TanStack Start migration landed: the document is rendered per request by a Node
process, so there is no directory of HTML to serve. `dist/client` lives inside
the web image and is served by the same process — see the "deliberately absent"
note in [node-adapter.ts](../../apps/web/server/node-adapter.ts) for the split
of responsibilities between it and Nginx.
