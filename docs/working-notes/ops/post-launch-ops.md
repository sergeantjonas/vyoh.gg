# Post-launch operations

**Status:** Active — opened 2026-09-17, the day vyoh.gg went live, from what the launch itself exposed. Three chunks, each independently landable, plus a routine-operations reference that did not exist before. The launch runbook in [hosting.md](hosting.md#launch-runbook--added-2026-08-20) is deliberately a one-time document; **this is the one that applies every day after it**. Read this before touching `scripts/deploy.sh`.

The runbook covered getting to production and covered it well. What no document covered was what happens on the two hundred days after — deploying a change, rolling one back, and noticing that something has quietly stopped working. Each chunk below traces to something that actually happened on 2026-09-17 rather than to a general sense that operations deserve attention.

## Routine operations

The reference half of this note. Nothing here is planned work.

### Deploy a change

```sh
VYOH_DEPLOY_HOST=vyoh scripts/deploy.sh
```

One command, from the repo root on the laptop. It refuses before touching the box if `sha-<7>` of HEAD is not published, ships the ops files, pulls both images, brings the stack up with `--no-build`, and smoke-checks the loopback endpoints. `main` is protected, so the commit has to be merged and its `images` job green first — the refusal is what tells you it is not.

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

This is the smallest of the three and the least interesting, which is exactly why it is written down instead of remembered.

## Not in scope

- **The off-box backup copy.** Tracked as the open half of the backup gate in [hosting.md § 6](hosting.md#6-backups--added-2026-08-01); it is a decision about a storage target, not an operations improvement.
- **E3, sourcemaps and releases.** The last open launch gate, owned by [error-tracking.md](error-tracking.md).
- **Uptime monitoring.** No external check watches the box today. Deliberately left out until there is a reason beyond completeness — the site is a portfolio surface, not a service with an SLA, and the honest first question is who would be woken up.
