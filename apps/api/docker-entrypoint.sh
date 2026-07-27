#!/bin/sh
set -eu

# Migrations run on every start rather than as a step in deploy.sh. `migrate
# deploy` is a no-op once the journal is current, so the cost is one query on a
# restart, and the alternative loses: a container that comes back after a crash
# would otherwise serve against whatever schema it happened to find.
echo "api: applying migrations"
./node_modules/.bin/prisma migrate deploy

# exec, so the server is PID 1 and receives SIGTERM from `docker stop` directly.
echo "api: starting"
exec node dist/src/main.js
