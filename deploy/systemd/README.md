# Systemd units

One nightly timer that runs [`scripts/backup.sh`](../../scripts/backup.sh)
against the production stack, then [`scripts/offsite.sh`](../../scripts/offsite.sh)
on the archive it wrote. Rationale for backing up at all, and what the
dump actually protects, lives in
[hosting.md § 6](../../docs/working-notes/ops/hosting.md).

```
deploy/systemd/vyoh-backup.service → /etc/systemd/system/vyoh-backup.service
deploy/systemd/vyoh-backup.timer   → /etc/systemd/system/vyoh-backup.timer
```

The unit hardcodes `/srv/vyoh` because that is the deploy path
`scripts/deploy.sh` rsyncs to. If `VYOH_DEPLOY_PATH` ever changes, this changes
with it.

## Install

```sh
sudo install -d -m 700 -o deploy -g deploy /var/backups/vyoh
sudo cp deploy/systemd/vyoh-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vyoh-backup.timer
```

Run it once by hand before trusting the schedule, then drill the result:

```sh
sudo systemctl start vyoh-backup.service
sudo journalctl -u vyoh-backup.service -n 30 --no-pager
cd /srv/vyoh && scripts/restore.sh "$(ls -1d /var/backups/vyoh/*.dump | tail -1)"
```

The unit runs as `deploy` and the directory is deploy's, so the drill needs no
`sudo`. If `ls` says permission denied, the directory is root's, and the unit
cannot write to it either: `sudo chown -R deploy:deploy /var/backups/vyoh`, and
do it before installing a unit that runs as deploy, or the next night's dump
fails with nothing to say so.

That command is the **drill** — it changes nothing. Restoring over a real
production database is a different operation with its own procedure and its own
traps (what `migrate deploy` does to the restored schema on the next api start,
and what happens to `Session` rows): see
[hosting.md § 6 "Restoring prod after an incident"](../../docs/working-notes/ops/hosting.md).

`restore.sh` with no flags restores into a throwaway database, compares exact
per-table row counts against the live one, and drops the copy. It needs room
for a second copy of the database while it runs — the dump is compressed, the
restore is not. Row counts that drift *upward* are expected on a live box: the
dump is a snapshot and the pollers keep writing. Anything reported `GONE` or
`EMPTY` is not.

## The off-box copy

The unit's second `ExecStart`, [`scripts/offsite.sh`](../../scripts/offsite.sh),
seals the archive `backup.sh` just wrote with `age` and uploads it to the
`vyoh-gg-backup` bucket on Backblaze B2. It needs three things on the box
before the unit is installed:

```sh
sudo apt install -y age jq
sudo install -d -m 700 /etc/vyoh
sudoedit /etc/vyoh/offsite.env && sudo chmod 600 /etc/vyoh/offsite.env
```

holding, unquoted:

```
VYOH_B2_KEY_ID=…
VYOH_B2_APPLICATION_KEY=…
VYOH_AGE_RECIPIENT=age1…
```

The key holds `writeFiles` alone, on that one bucket, under `vyoh/`, made
through `b2_create_key` with that exact list rather than one of the console's
presets. The script checks it on every run and refuses anything more, so a
master key pasted in by mistake sends nothing rather than working quietly.
A missing file costs the off-box copy and not the local dump: the unit still
dumps, then fails on the unset values.

Retention is the bucket's, not the script's: a 30-day compliance-mode Object
Lock, and a lifecycle rule that hides a copy 30 days after upload and deletes it
a day later.

The drill for the off-box copy runs from the laptop, because the age private
key must never be on the box. [`scripts/offsite-drill.sh`](../../scripts/offsite-drill.sh)
fetches the newest copy with a second, laptop-held key (`listFiles`,
`readFiles`, `readFileRetentions`, same bucket and prefix), checks its SHA-1,
reports how many copies there are and the lock the newest carries, decrypts it,
and hands it to `restore.sh`'s drill on the box:

```sh
VYOH_DEPLOY_HOST=vyoh VYOH_AGE_IDENTITY=<(…the private key…) scripts/offsite-drill.sh
```

with `VYOH_DRILL_KEY_ID` and `VYOH_DRILL_APPLICATION_KEY` exported. The
decrypted archive crosses the laptop's uplink to reach the box, which is the
slow part. The newest copy can be up to a day old, and `restore.sh` compares it
against live, so a table a migration added since then reads `GONE`. After a
deploy that migrates, start `vyoh-backup.service` by hand before drilling.

## Checking it is still working

A backup timer fails silently by nature: nothing looks different until the
morning you need it. So every run checks in with healthchecks.io, through
[`scripts/heartbeat.sh`](../../scripts/heartbeat.sh) from the unit's
`ExecStopPost`: a success, or a failure carrying the run's last journal lines.
The `vyoh-backup` check emails at once on a failure, and also when nothing has
arrived by 05:30, which is what catches a timer that never fired or a box that
is down: neither can report itself.

To install it, make the check by hand in vyoh's own healthchecks.io project:
slug `vyoh-backup`, an OnCalendar schedule of `*-*-* 03:30:00` in
Europe/Brussels, 2 hours' grace. Left on UTC, it would expect the run an hour
or two late and never line up. Then give the box the project's ping key and
reinstall the unit:

```sh
sudo install -d -m 700 /etc/vyoh
sudoedit /etc/vyoh/heartbeat.env && sudo chmod 600 /etc/vyoh/heartbeat.env
sudo cp deploy/systemd/vyoh-backup.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl start vyoh-backup.service   # the first check-in
```

holding `VYOH_HC_PING_KEY=…`, unquoted. Anyone holding the key can report a
false success, which is why it reaches curl on stdin. Without the file the unit
still runs, and the check going quiet is the failure showing.

Three commands, for when you are on the box anyway:

```sh
systemctl list-timers vyoh-backup --all          # last run, next run
systemctl status vyoh-backup.service --no-pager  # how it ended; "Sent … off the box"
ls -lhA /var/backups/vyoh                        # newest file recent, size plausible, no stray dotfiles
```

The second is the only one that sees the off-box copy. A failed upload leaves
the timer's last run and the newest local archive looking exactly as they do on
a good night, because the dump before it succeeded.

A dump that suddenly halves in size is more alarming than one that fails
outright, because the failure is loud and the shrink is not.

## Known gaps

**The off-box copy is locked for 30 days, not forever.** Someone who owns the
box can stop the uploads and hide every copy with the upload key, and the
lifecycle rule then deletes each one as its lock runs out. Noticing a stopped
backup within the month is what the lock buys, and the healthchecks.io check
above is what does the noticing — unless they also send its check-ins, which
the ping key on the box lets them do.

**A success is not checked for being right.** A dump that halves in size still
reports success. The drills are what judge the content.

**The archives on the box are unencrypted**, deliberately. They hold this
project's own data, the owner's GitHub id, and `Session` rows whose tokens are
already hashed — no third-party PII. On storage the owner controls, a
passphrase is mostly one more thing that can be lost, and losing it turns a
recoverable incident into an unrecoverable one. That trade changes the moment
this database holds anyone else's data. B2 is not storage the owner controls,
which is why the copy sent there is sealed, and why the age private key stays
with the owner, off every machine this repo deploys to.
