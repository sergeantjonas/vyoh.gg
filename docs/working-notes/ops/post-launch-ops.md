# Post-launch operations

**Status:** Active — opened 2026-09-17, the day vyoh.gg went live, from what the launch itself exposed. Four chunks, each independently landable, plus a routine-operations reference that did not exist before. The launch runbook in [hosting.md](hosting.md#launch-runbook--added-2026-08-20) is deliberately a one-time document; **this is the one that applies every day after it**. Read this before touching `scripts/deploy.sh`.

The runbook covered getting to production and covered it well. What no document covered was what happens on the two hundred days after — deploying a change, rolling one back, and noticing that something has quietly stopped working. Each chunk below traces to something that actually happened on 2026-09-17 rather than to a general sense that operations deserve attention.

## Routine operations

The reference half of this note. Nothing here is planned work.

### Deploy a change

```sh
VYOH_DEPLOY_HOST=vyoh scripts/deploy.sh
```

One command, from the repo root on the laptop. It refuses before touching the box if `sha-<7>` of HEAD is not published, ships the ops files, pulls both images, brings the stack up with `--no-build`, and smoke-checks the loopback endpoints. `main` is protected, so the commit has to be merged and its `images` job green first — the refusal is what tells you it is not.

Nothing needs doing on the box afterwards. `up -d` recreates whatever changed and blocks on the healthchecks. It also picks up `/srv/vyoh/.env` edits, because compose re-resolves configuration on every `up` — the only time a manual `up` is needed is editing `.env` *without* deploying, and then the image tag has to be passed explicitly or it falls back to the `main` default and quietly moves off the pinned build.

**But the deploy does not touch nginx or systemd.** It rsyncs `deploy/` to `/srv/vyoh/deploy/` and stops. `/etc/nginx/` and `/etc/systemd/system/` hold *copies*, not symlinks, so a changed vhost, a changed `vyoh-cache.conf` or a changed unit file lands on the box while the running configuration stays stale — and the deploy reports success either way. Installing is manual and needs `sudo`, which `deploy.sh` deliberately does not have:

```sh
sudo cp /srv/vyoh/deploy/nginx/vyoh.gg.conf /etc/nginx/sites-available/
sudo nginx -t && sudo systemctl reload nginx
```

Chunk 4 makes that drift loud rather than automating it away.

### Roll back

```sh
VYOH_IMAGE_TAG=sha-<old> scripts/deploy.sh
```

A tag, not a rebuild, which is the whole point of the registry pipeline: recovery under incident pressure costs a pull rather than a Vite SSR build on a box that is already unhappy. `/srv/vyoh/.image-tag` records what is running and is the answer to "what is live", not "what was last known good". **Untested as of writing — that is chunk 2.**

A rollback moves images only. It does not undo a migration, and `migrate deploy` runs on every api start, so rolling back past a schema change needs the restore procedure in [hosting.md § 6](hosting.md#restoring-prod-after-an-incident) instead.

### Notice something is wrong

```sh
ssh vyoh 'cd /srv/vyoh && docker compose -f compose.prod.yaml ps'
systemctl list-timers vyoh-backup --all    # last run, next run
ls -lh /var/backups/vyoh                   # newest recent, size plausible
```

A backup timer fails silently by nature, and a dump that halves in size is more alarming than one that fails outright — the failure is loud and the shrink is not. Sentry covers the application tiers now that both DSNs are set; it does not watch the box, the timer, or the certificate.

## Before the second tenant

The box was always meant to host more than vyoh.gg — [hosting.md § Multi-site target shape](hosting.md#multi-site-target-shape-single-vps-n-projects) is the plan, written before the box existed, and the launch followed it: host-installed nginx with one vhost file per project, every container bound to `127.0.0.1` so nginx is the only ingress, overridable ports, `/srv/<project>` and `/var/backups/<project>`, log caps so one noisy tenant cannot fill a shared disk. The 8 GB sizing only holds because builds moved off-box, and that headroom *is* the tenant budget.

Four things are not ready, and all four get harder once there is a neighbour rather than easier. That is the whole argument for doing them while the box has exactly one tenant.

**Postgres is the real divergence.** The target shape is one cluster with a database and role per project; what runs is a postgres container belonging to vyoh's compose stack, publishing `127.0.0.1:5432`. A second project either collides on that port or brings its own cluster, and a cluster per project is exactly the few-hundred-MB waste the plan rejected. Nothing is wrong today — the cost is that the documented end state is not what exists, and migrating a live database to a shared cluster is meaningfully harder than starting with one.

**Port allocation has no record.** 2009, 2010 and 5432 are taken and nothing anywhere says so. The fix is not a registry file, which drifts the first time someone forgets to update it — it is a convention of asking the box, since the box cannot be wrong: `ssh vyoh 'ss -lntp'` before picking a port.

**There are no resource limits.** `compose.prod.yaml` caps logs but sets no `deploy.resources.limits`, so on 8 GB one tenant can starve the others. Cheap to add now, and much cheaper than diagnosing it later as "the site got slow when I deployed the other thing".

**nginx zone names are only half namespaced.** `vyoh-cache.conf` declares `vyoh_img`, but also `api_general`, `api_img` and `api_conn` — bare names in `conf.d/`, which is a single global namespace. A second project declaring `zone=api_general` makes nginx refuse to load, and the error will not obviously point at this file. Renaming them to `vyoh_*` is a one-line change per zone plus the matching `limit_req`/`limit_conn` references in the api vhost, and it is free today and disruptive later.

## Chunk 1 — smoke the public URL, not just loopback

`deploy.sh` curls `127.0.0.1:2009` and `127.0.0.1:2010` **from the box**, then prints `Deployed sha-… to vyoh.` On 2026-09-17 it printed exactly that while `vyoh.gg` was unreachable from the internet, because the A records pointed at netcup's gateway instead of the server. Every layer that was actually broken — DNS, nginx, TLS, the firewall — sits above the loopback the smoke was testing.

The loopback check earns its place: it isolates "the containers came up" from "the world can reach them", and that distinction is worth having when something *is* wrong. The gap is that only the first half is tested, while the success message speaks for both.

**Shape:** after the existing loopback smoke passes, curl `https://vyoh.gg/`, `https://www.vyoh.gg/` and `https://api.vyoh.gg/health` **from the laptop**, and fail the deploy if any does not answer 200. From the laptop specifically — a curl run on the box can be satisfied by a hosts entry or a loopback route and prove nothing about what a visitor gets.

Two details worth getting right rather than discovering later. The public origins have to be overridable (`VYOH_PUBLIC_WEB_URL` / `VYOH_PUBLIC_API_URL`) or the script becomes unusable for a second tenant on the same box, which [hosting.md § Multi-site target shape](hosting.md#multi-site-target-shape-single-vps-n-projects) expects. And the failure message should distinguish itself from the loopback one: "containers are up but the site is unreachable" points at DNS, nginx or the firewall, where the existing message points at the stack.

## Chunk 2 — rehearse the rollback

Rollback is documented, plausible, and has never been run. That is the same position backups were in before 2026-09-17, and the drill that day is the argument for this one: rehearsing recovery while nothing is on fire is what turns a documented procedure into a known one. There are now two real tags to do it with.

**Shape:** roll back to the previous `sha-`, confirm the site still serves and `/srv/vyoh/.image-tag` names the old tag, then roll forward again. Record what actually happens, particularly around the api's `migrate deploy` on start — the two tags in question have no migration between them, which makes this a clean first rehearsal rather than a compound one.

Worth finding out and writing down: how long the round trip takes, whether `docker image prune -f` in the deploy has already removed the images a rollback wants, and whether anything in the web bundle's baked `__BUILD_COMMIT__` reads oddly afterwards.

## Chunk 3 — say when error reporting is off

`SENTRY_DSN` and `SENTRY_WEB_DSN` carry `:-` defaults rather than `:?` guards, deliberately: an absent DSN disables the SDK, which is correct in dev and must not fail a boot. The cost is that an empty one is indistinguishable at runtime from a healthy one with nothing to report. Between first deploy and the evening of 2026-09-17, production reported nothing and looked exactly like production reporting nothing because nothing had gone wrong.

**Shape:** have `deploy.sh` read the two values from `/srv/vyoh/.env` and print a warning — not a failure — when either is empty. A failure would be wrong: a deploy with error tracking off is a legitimate state, it just should not be a silent one.

The smallest of the four and the least interesting, which is exactly why it is written down instead of remembered.

## Chunk 4 — warn when the shipped ops config is not the installed one

The third member of the family chunks 1 and 3 belong to: a deploy that reports success while something it shipped is not in effect. A changed nginx vhost or systemd unit reaches `/srv/vyoh/deploy/` and goes no further, and nothing says so.

**Do not automate the install.** Copying into `/etc/nginx/` and reloading needs `sudo`, and `deploy.sh` runs as `deploy` over ssh specifically so it does not have it — the `docker` group is the one privilege it was given. Granting a sudoers rule to save two commands would trade a deliberate boundary for convenience, and an automatic `systemctl reload nginx` inside a deploy is a good way to take the site down on a config that `nginx -t` would have caught.

**Shape:** after the rsync, `diff` each file under `/srv/vyoh/deploy/nginx/` against its counterpart in `/etc/nginx/`, and each unit against `/etc/systemd/system/`. Print the list of files that differ, with the `sudo cp` line needed to install them. No sudo required to read either location, so this stays inside the privileges the script already has.

Worth deciding when writing it: whether drift should be a warning or a non-zero exit. A warning matches chunk 3's reasoning — shipping a config change you have not installed yet is a legitimate intermediate state. The counter-argument is that unlike an absent Sentry DSN, this one silently persists across every later deploy, since each one re-ships the same already-diverged file.

## Not in scope

- **The off-box backup copy.** Tracked as the open half of the backup gate in [hosting.md § 6](hosting.md#6-backups--added-2026-08-01); it is a decision about a storage target, not an operations improvement.
- **E3, sourcemaps and releases.** The last open launch gate, owned by [error-tracking.md](error-tracking.md).
- **Uptime monitoring.** No external check watches the box today. Deliberately left out until there is a reason beyond completeness — the site is a portfolio surface, not a service with an SLA, and the honest first question is who would be woken up.
