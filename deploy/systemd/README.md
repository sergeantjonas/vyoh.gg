# Systemd units

One nightly timer that runs [`scripts/backup.sh`](../../scripts/backup.sh)
against the production stack. Rationale for backing up at all, and what the
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
sudo install -d -m 700 /var/backups/vyoh
sudo cp deploy/systemd/vyoh-backup.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vyoh-backup.timer
```

Run it once by hand before trusting the schedule, then drill the result:

```sh
sudo systemctl start vyoh-backup.service
sudo journalctl -u vyoh-backup.service -n 30 --no-pager
sudo bash -c 'cd /srv/vyoh && scripts/restore.sh "$(ls -1d /var/backups/vyoh/*.dump | tail -1)"'
```

The last one runs the whole thing under root on purpose. The backup directory
is mode 700, so a `$(ls …)` written outside the `bash -c` would be expanded by
the calling shell, fail to read the directory, and hand `restore.sh` an empty
path.

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

## Checking it is still working

A backup timer fails silently by nature: nothing looks different until the
morning you need it. Two commands, worth running whenever you are on the box
anyway:

```sh
systemctl list-timers vyoh-backup --all   # last run, next run
ls -lh /var/backups/vyoh                  # newest file recent, size plausible
```

A dump that suddenly halves in size is more alarming than one that fails
outright, because the failure is loud and the shrink is not.

## Known gaps

**There is no off-box copy yet.** The archives sit on the same disk as the
volume they protect, so this survives a bad migration, a dropped table, or a
botched restore — and not a dead disk or a lost server. Closing that is the
open half of the launch gate; see hosting.md § 6.

**The archives are unencrypted**, deliberately. They hold this project's own
data, the owner's GitHub id, and `Session` rows whose tokens are already
hashed — no third-party PII. On storage the owner controls, a passphrase is
mostly one more thing that can be lost, and losing it turns a recoverable
incident into an unrecoverable one. That trade changes the moment this database
holds anyone else's data.
