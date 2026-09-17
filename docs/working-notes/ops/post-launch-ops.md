# Post-launch operations

**Status:** Active — opened 2026-09-17, the day vyoh.gg went live, from what the launch itself exposed. Four chunks, each independently landable, **chunks 1, 3 and 4 shipped the same evening**, plus a routine-operations reference that did not exist before. The launch runbook in [hosting.md](hosting.md#launch-runbook--added-2026-08-20) is deliberately a one-time document; **this is the one that applies every day after it**. Read this before touching `scripts/deploy.sh`.

The runbook covered getting to production and covered it well. What no document covered was what happens on the two hundred days after — deploying a change, rolling one back, and noticing that something has quietly stopped working. Each chunk below traces to something that actually happened on 2026-09-17 rather than to a general sense that operations deserve attention.

## Routine operations

The reference half of this note. Nothing here is planned work.

### Deploy a change

```sh
VYOH_DEPLOY_HOST=vyoh scripts/deploy.sh
```

One command, from the repo root on the laptop. It refuses before touching the box if `sha-<7>` of HEAD is not published, ships the ops files, pulls both images, brings the stack up with `--no-build`, smoke-checks the loopback endpoints, and then smoke-checks the public URLs from your machine. `main` is protected, so the commit has to be merged and its `images` job green first — the refusal is what tells you it is not.

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

The box was always meant to host more than vyoh.gg — the machine-level conventions live in the `shared-vps` skill, and the launch followed them: host-installed nginx with one vhost file per project, every container bound to `127.0.0.1` so nginx is the only ingress, overridable ports, `/srv/<project>` and `/var/backups/<project>`, log caps so one noisy tenant cannot fill a shared disk. The 8 GB sizing only holds because builds moved off-box, and that headroom *is* the tenant budget.

Four items were raised here on 2026-09-17. **Three are closed the same day and the fourth is now a decision rather than a gap.**

**Postgres: per-project clusters, decided 2026-09-17 — the plan was amended, not the box.** The old target shape said one cluster with a database and role per project, on the grounds that a cluster each wastes a few hundred MB. Measured on the live box that day: web 155 MiB, api 339 MiB, postgres 254 MiB, 748 MiB total against 7.9 GB, with 6.6 GB available. So a second cluster costs roughly 250 MiB out of 6.6 GB spare, and consolidating would buy about 4% of RAM at three tenants in exchange for coupling independent projects into one failure domain, one upgrade schedule, and a `compose.prod.yaml` that no longer stands its own database up. The counter-argument is real and was weighed: one cluster with a role per project is the better ops story for a portfolio box. It lost on the arithmetic. **Revisit past roughly five tenants, or on a smaller VPS, where the numbers actually change.** What still matters is the port convention — ask the box before picking one, so a second database does not collide on 5432.

**Port allocation: closed as a convention, not a file.** A registry drifts the first time someone forgets it. `ssh vyoh 'ss -lntp'` before picking a port cannot.

**Resource limits: shipped 2026-09-17.** Memory ceilings at roughly 3x measured — postgres 1g, api 1536m, web 768m — so a runaway query or a leaking backfill hits its own container rather than the box, where the OOM killer picks by score rather than by blame. No CPU limits: on 4 vCPU, throttling a legitimate sync tick costs more than it protects, and CPU starvation degrades where memory starvation kills.

**nginx zone names: shipped 2026-09-17.** `api_general`, `api_img` and `api_conn` became `vyoh_api_*`, joining `vyoh_img`. `conf.d/` is one global namespace and a second project declaring `zone=api_general` would have made nginx refuse to load, with an error naming neither file.

**Installing that rename has a trap worth reading before you do it.** The two files must change together — `vyoh-cache.conf` declares the zones and `api.vyoh.gg.conf` references them, and nginx refuses to load a vhost naming a zone that does not exist. But **you cannot `sudo cp` the repo's `api.vyoh.gg.conf` over the installed one**: certbot rewrote that copy in place to add the `listen 443 ssl` block, the certificate paths and the `:80` redirect, none of which are in the repo version by decision. Copying it over drops TLS. Edit the installed file in place instead, then install the cache file, then test once:

```sh
sudo cp /srv/vyoh/deploy/nginx/vyoh-cache.conf /etc/nginx/conf.d/
sudo sed -i 's/zone=api_general/zone=vyoh_api_general/g; s/zone=api_img/zone=vyoh_api_img/g; s/limit_conn api_conn/limit_conn vyoh_api_conn/g' /etc/nginx/sites-available/api.vyoh.gg.conf
sudo nginx -t && sudo systemctl reload nginx
```

This is the general shape of the problem chunk 4 warns about, not a one-off: **any vhost certbot has touched can never be installed by copying.** Worth remembering the next time a vhost changes in the repo.

## Chunk 1 — smoke the public URL, not just loopback — SHIPPED 2026-09-17

Landed the same evening it was scoped. `deploy.sh` now runs a second smoke from the laptop after the loopback one passes, against `VYOH_PUBLIC_WEB_URL` (default `https://vyoh.gg`), its `/robots.txt`, and `VYOH_PUBLIC_API_URL/health` (default `https://api.vyoh.gg`), and exits non-zero with a message that points at DNS, nginx, TLS or the firewall rather than at the containers.

One deviation from the shape below: **`www` is not checked.** It resolves and answers 200 directly rather than redirecting, so it would work — but the public web URL is a single overridable variable, and deriving `www.` from it would break for a tenant that does not have that name. Two overridable origins beat three with one of them inferred.

The original scoping follows.

`deploy.sh` curls `127.0.0.1:2009` and `127.0.0.1:2010` **from the box**, then prints `Deployed sha-… to vyoh.` On 2026-09-17 it printed exactly that while `vyoh.gg` was unreachable from the internet, because the A records pointed at netcup's gateway instead of the server. Every layer that was actually broken — DNS, nginx, TLS, the firewall — sits above the loopback the smoke was testing.

The loopback check earns its place: it isolates "the containers came up" from "the world can reach them", and that distinction is worth having when something *is* wrong. The gap is that only the first half is tested, while the success message speaks for both.

**Shape:** after the existing loopback smoke passes, curl `https://vyoh.gg/`, `https://www.vyoh.gg/` and `https://api.vyoh.gg/health` **from the laptop**, and fail the deploy if any does not answer 200. From the laptop specifically — a curl run on the box can be satisfied by a hosts entry or a loopback route and prove nothing about what a visitor gets.

Two details worth getting right rather than discovering later. The public origins have to be overridable (`VYOH_PUBLIC_WEB_URL` / `VYOH_PUBLIC_API_URL`) or the script becomes unusable for a second tenant on the same box, which [hosting.md § Multi-site target shape](hosting.md#multi-site-target-shape-single-vps-n-projects) expects. And the failure message should distinguish itself from the loopback one: "containers are up but the site is unreachable" points at DNS, nginx or the firewall, where the existing message points at the stack.

## Chunk 2 — rehearse the rollback

Rollback is documented, plausible, and has never been run. That is the same position backups were in before 2026-09-17, and the drill that day is the argument for this one: rehearsing recovery while nothing is on fire is what turns a documented procedure into a known one. There are now two real tags to do it with.

**Shape:** roll back to the previous `sha-`, confirm the site still serves and `/srv/vyoh/.image-tag` names the old tag, then roll forward again. Record what actually happens, particularly around the api's `migrate deploy` on start — the two tags in question have no migration between them, which makes this a clean first rehearsal rather than a compound one.

Worth finding out and writing down: how long the round trip takes, whether `docker image prune -f` in the deploy has already removed the images a rollback wants, and whether anything in the web bundle's baked `__BUILD_COMMIT__` reads oddly afterwards.

## Chunk 3 — say when error reporting is off — SHIPPED 2026-09-17

`deploy.sh` reads both DSNs from `/srv/vyoh/.env` after the smoke and names any that is empty, as a warning. Values are never printed, only variable names. It reads the file rather than asking the container because an *empty* value is the thing being looked for, and `printenv` cannot distinguish unset from empty once the compose `:-` default has been applied. The original scoping follows.

`SENTRY_DSN` and `SENTRY_WEB_DSN` carry `:-` defaults rather than `:?` guards, deliberately: an absent DSN disables the SDK, which is correct in dev and must not fail a boot. The cost is that an empty one is indistinguishable at runtime from a healthy one with nothing to report. Between first deploy and the evening of 2026-09-17, production reported nothing and looked exactly like production reporting nothing because nothing had gone wrong.

**Shape:** have `deploy.sh` read the two values from `/srv/vyoh/.env` and print a warning — not a failure — when either is empty. A failure would be wrong: a deploy with error tracking off is a legitimate state, it just should not be a silent one.

The smallest of the four and the least interesting, which is exactly why it is written down instead of remembered.

## Chunk 4 — warn when the shipped ops config is not the installed one — SHIPPED 2026-09-17

**The shape below was wrong, and running it against the box is what showed that.** A content `diff` reports both vhosts as differing on every deploy, permanently: certbot rewrote the installed copies in place to add the TLS blocks and the `:80` redirect, while the repo keeps them plain HTTP by decision. A check that fires every time is noise, and noise is what the deploy already had too much of.

**What shipped compares mtimes instead — shipped newer than installed.** That stays silent through certbot's edits, which make the *installed* copy newer, and speaks up for the case that actually matters: a file edited in the repo, shipped by the rsync, never installed. `rsync -a` preserves mtimes, which is what makes it work. A fresh clone resets them and earns one spurious warning, at a moment when "check whether the box matches" is the right instinct anyway. It also reports `absent` for a file never installed at all.

First real run, 2026-09-17, caught drift correctly on both nginx files with no false positives — and exposed a defect in its own output. The warning printed a generic `sudo cp <file> /etc/nginx/sites-available/` hint, which is the wrong destination for `vyoh-cache.conf` and actively dangerous for `api.vyoh.gg.conf`: copying over a certbot-rewritten vhost drops the TLS block. **A hint that is right for one path and catastrophic for another is worse than no hint**, so it now points at the destination the check already computed and names the certbot constraint instead of guessing a command.

The round trip is verified end to end: the check fired on real drift, the rename was installed (`vyoh-cache.conf` copied, `api.vyoh.gg.conf` edited in place to preserve certbot's TLS block), and the next deploy reported `notices: none`. Firing was easy to test; clearing was the half that needed real drift to resolve.

Settled the open question the scoping left: **a warning, not a non-zero exit.** The counter-argument was that this drift persists across later deploys where an absent DSN does not — true, but the answer to a persistent warning is to install the file, and failing the deploy would punish a legitimate intermediate state.

The original scoping follows.

The third member of the family chunks 1 and 3 belong to: a deploy that reports success while something it shipped is not in effect. A changed nginx vhost or systemd unit reaches `/srv/vyoh/deploy/` and goes no further, and nothing says so.

**Do not automate the install.** Copying into `/etc/nginx/` and reloading needs `sudo`, and `deploy.sh` runs as `deploy` over ssh specifically so it does not have it — the `docker` group is the one privilege it was given. Granting a sudoers rule to save two commands would trade a deliberate boundary for convenience, and an automatic `systemctl reload nginx` inside a deploy is a good way to take the site down on a config that `nginx -t` would have caught.

**Shape:** after the rsync, `diff` each file under `/srv/vyoh/deploy/nginx/` against its counterpart in `/etc/nginx/`, and each unit against `/etc/systemd/system/`. Print the list of files that differ, with the `sudo cp` line needed to install them. No sudo required to read either location, so this stays inside the privileges the script already has.

Worth deciding when writing it: whether drift should be a warning or a non-zero exit. A warning matches chunk 3's reasoning — shipping a config change you have not installed yet is a legitimate intermediate state. The counter-argument is that unlike an absent Sentry DSN, this one silently persists across every later deploy, since each one re-ships the same already-diverged file.

## Not in scope

- **The off-box backup copy.** Tracked as the open half of the backup gate in [hosting.md § 6](hosting.md#6-backups--added-2026-08-01); it is a decision about a storage target, not an operations improvement.
- **E3, sourcemaps and releases.** The last open launch gate, owned by [error-tracking.md](error-tracking.md).
- **Uptime monitoring.** No external check watches the box today. Deliberately left out until there is a reason beyond completeness — the site is a portfolio surface, not a service with an SLA, and the honest first question is who would be woken up.
