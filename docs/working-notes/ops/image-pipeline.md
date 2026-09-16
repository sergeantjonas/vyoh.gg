# Image pipeline — build in CI, pull on the box

**Status:** Active — **scoped 2026-09-16; chunks 1 and 3 shipped and chunk 1 verified green the same day** (run `35148907656`, both images published and anonymously pullable). **Chunk 2 is what is left.** Replaces the on-box build in `scripts/deploy.sh` with images built by GitHub Actions and pushed to GHCR; the box only pulls. This is what makes the 8 GB box in [hosting.md](hosting.md) valid — the sizing argument for 16 GB rested entirely on `pnpm install` plus the Vite SSR build peaking at several GB next to a live stack, and that spike moves to a GitHub runner. Four chunks; the first two are the pipeline, the third is the documentation debt they create, the fourth is optional. **Chunk 2 is what is left before launch** — it is testable locally but only proven on the box, and runbook step 5 now depends on it.

## Why now, and why this shape

Three things changed on 2026-09-16 that make this a launch step rather than a nicety:

- **The box is a netcup VPS 1000 G12** (4 vCPU / 8 GB / 256 GB NVMe, Nuremberg, x86, hourly billing), not the Hetzner CX43 the runbook names. Hetzner has had every CX and CAX plan unavailable since early September with no restock date. On 8 GB an on-box build next to Postgres and two Node processes is the OOM the sizing section warned about.
- **Wire-shape changes must deploy api and web together** ([pre-launch-sweep.md](pre-launch-sweep.md), standing rules). Two images tagged with the same commit sha make that structural instead of procedural.
- **Rollback becomes a tag.** Today a bad deploy means re-rsyncing an older tree and rebuilding under incident pressure. With a registry it is `VYOH_IMAGE_TAG=sha-<old> scripts/deploy.sh`.

Shape decisions, made here so the chunks do not re-open them:

- **Build on every push to `main`, deploy by hand.** The build job is cheap and cached; the deploy stays a deliberate owner action from a local shell, which is the runbook's philosophy and also what branch protection (still off, decided 2026-07-26) would otherwise be needed for. A `workflow_dispatch` deploy over SSH is chunk 4, not the default.
- **Build gated on the check job.** The image job lives in `ci.yml` with `needs: [check]` so a red `main` never publishes. Cross-workflow `needs` does not exist, which is why it is not a separate file.
- **`linux/amd64` only.** The box is x86. The api Dockerfile keys its onnxruntime prune off `TARGETARCH`, which buildx sets from `--platform`, so no Dockerfile change. A multi-arch matrix buys nothing until a second box exists and costs a QEMU build of Prisma and Sharp every push.
- **Tags are `sha-<7>` plus a moving `main`.** Deploy pins a sha; `main` exists for humans reading the GHCR page and for `docker compose pull` with no tag set.
- **Public images.** The box pulls anonymously — no registry credential on the box. **Confirmed on the first run**: both packages came out publicly pullable with no manual step, verified by an anonymous manifest fetch and a `docker pull` under an empty `DOCKER_CONFIG`. A claim to the contrary was written here while scoping chunk 1, from the docs line that a first publish is private — that describes personal-scope publishing, not a package the `images` job creates in a public repo's namespace. If a future package ever does come out private, flipping it is a one-time settings change, not a pipeline problem. Everything baked into the web image (`VITE_API_URL`, `VITE_SITE_URL`, later the browser Sentry DSN) is already public in the served bundle.
- **Build args come from GitHub Actions repository variables**, not secrets: `VITE_API_URL`, `VITE_SITE_URL`. `BUILD_COMMIT` is `github.sha` cut to seven. Runtime secrets stay in `/srv/vyoh/.env` on the box exactly as runbook step 2 says; the pipeline never sees them.
- **Keep `build:` in `compose.prod.yaml` alongside `image:`.** Compose allows both; `docker compose build` still works for the container-divergence probes in [repo-conventions-web.md](../../repo-conventions-web.md), and deploy uses `pull` + `up -d --no-build` so it can never fall back to building on the box by accident.

## Chunk 1 — build and push job · shipped 2026-09-16

`.github/workflows/ci.yml` gains one job. Files: `ci.yml` only.

Shipped as the `images` job, with the action majors current at the time — `setup-buildx-action@v4`, `login-action@v4`, `metadata-action@v6`, `build-push-action@v7`. Three things the scope below did not settle, decided while writing it:

- **The api probe runs `--entrypoint node`.** The literal `docker run --rm <image> node -e …` below passes those words to `docker-entrypoint.sh` as arguments, and that script runs `prisma migrate deploy` first — so the probe would fail against a database the job has not got, for a reason that has nothing to do with onnx.
- **Both pushes sit behind both smokes**, rather than each image pushing once its own probe passes. Publishing the api early leaves a commit whose `sha-<7>` names an api with no paired web image, which is the deploy-together invariant these tags exist to make structural.
- **`provenance: false` on the push steps.** A single-platform image without attestations is a plain manifest rather than an index carrying an `unknown/unknown` entry, which is what keeps the GHCR page readable for the humans the `main` tag is for.

Both probes were run against the pre-existing local `vyoh-api:local` and `vyoh-web:local` images before the job was written, so the commands are proven even though the job is not. The web one earned its retry loop there: the first `curl` was reset mid-boot.

- `permissions: { contents: read, packages: write }` on the job, `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, `needs: [check]`.
- `docker/setup-buildx-action`, `docker/login-action` against `ghcr.io` with `GITHUB_TOKEN`, `docker/metadata-action` producing `sha-<7>` and `main` tags for `ghcr.io/sergeantjonas/vyoh-api` and `ghcr.io/sergeantjonas/vyoh-web`.
- Two `docker/build-push-action` steps, `context: .`, `platforms: linux/amd64`, `cache-from/cache-to: type=gha,scope=<image>`. The web step passes `VITE_API_URL`, `VITE_SITE_URL` from `vars.*` and `BUILD_COMMIT` from the sha. The api step passes nothing — `BUILD_COMMIT` is a runtime env for the api, read from compose.
- **Smoke the api image in the job before pushing it**, because the one known silent failure is the onnx prune: `docker run --rm <image> node -e "require('onnxruntime-node')"`. Build with `load: true` and `push: false`, run the probe, then push in a second step reusing the cache. Without this the failure mode is exactly the one the Dockerfile comment warns about — an image that builds green and crashes on the first Steam artwork request.
- Smoke the web image the same way: run it with `PORT` set and `API_INTERNAL_URL` pointing at nothing, `curl -f localhost:$PORT/robots.txt`. That is what its `HEALTHCHECK` already does, so it is one line and proves the type-stripping entrypoint boots outside the Dockerfile's own build context.

Verify: the packages appear under the repo on GitHub; `docker pull ghcr.io/sergeantjonas/vyoh-web:sha-<7>` from the dev box works anonymously (OrbStack runs amd64 images under Rosetta, so `docker run` of the pulled image is also possible here); the `main` tag moves on the next push. **Verified green on 2026-09-16**, run `35148907656` at `90e43de`. Every claim above holds:

- Both packages publish, and both are **anonymously pullable without any manual flip** — checked by manifest fetch with a credential-free registry token and by `docker pull` under an empty `DOCKER_CONFIG`. The pulled web image boots and serves `/robots.txt`, which is the container-divergence probe in [repo-conventions-web.md](../../repo-conventions-web.md) run against the exact artefact rather than a local rebuild.
- **The two-pass build costs almost nothing.** Cold cache: api 262 s, web 181 s to build; 13 s and 8 s to push. The push pass re-walks the same graph, hits the builder's cache and only uploads, so gating both pushes behind both smokes is effectively free.
- **The variable guard works, and it is not a formality.** The first attempt failed it in four seconds because the repository variables did not exist yet. Worth knowing why the retry was needed at all: **`vars` is snapshotted when the run is created, not when the job starts**, so setting a variable mid-run does nothing for that run — it takes a re-run of the job.

First run took several minutes with a cold cache — pnpm's `--mount=type=cache` inside the Dockerfile does not persist across runners, only the layer cache does, and that is acceptable at this cadence. Still unverified: that the `main` tag *moves* on a second push, which only the next push to `main` shows.

## Chunk 2 — compose pulls, deploy.sh stops building · not started

Files: `compose.prod.yaml`, `scripts/deploy.sh`, `deploy/nginx/README.md` only if its install steps reference rsync'd paths that move.

- `compose.prod.yaml`: `image: ghcr.io/sergeantjonas/vyoh-api:${VYOH_IMAGE_TAG:-main}` and the web equivalent, both keeping their `build:` block. The web `build.args` stay for local builds; in production they are unused because the image is pulled. `BUILD_COMMIT` under `environment:` for both services stays — it is how the api and the SSR tier tag Sentry events.
- `scripts/deploy.sh`: takes the tag from `VYOH_IMAGE_TAG` (default: `sha-<git rev-parse --short HEAD>` of the local checkout, so the common case is unchanged: "deploy what I have"). Before touching the box, `docker manifest inspect` both images and refuse if either is missing — a sha that never built (a red check job, or a push not yet finished) must fail here, not as a `pull` error mid-deploy. The rsync narrows to the ops surface: `compose.prod.yaml`, `deploy/`, `scripts/backup.sh`, `scripts/restore.sh`. No source, no Dockerfiles, no `pnpm-lock.yaml`. Then `docker compose pull` and `up -d --no-build --wait`, `image prune` as today, the smoke checks as today.
- Write `VYOH_IMAGE_TAG` into a file on the box (`/srv/vyoh/.image-tag`) after a successful smoke, so "what is deployed" has an answer that does not depend on reading container labels.

Verify locally: `docker compose -f compose.prod.yaml config` resolves the images with and without `VYOH_IMAGE_TAG`; a deploy dry-run against a throwaway host (or `VYOH_DEPLOY_HOST=localhost` into a scratch directory) exercises the manifest check, the narrowed rsync and the `pull` path. The real proof is runbook step 5 on the box.

## Chunk 3 — the docs this invalidates · shipped 2026-09-16

Docs-only commit. Files: `hosting.md`, `pre-launch-sweep.md`, `open-work.md`, `error-tracking.md`, `repo-conventions-web.md`.

- [hosting.md](hosting.md) § Launch runbook **step 0** becomes the netcup VPS 1000 G12 as bought, with the Hetzner table kept as the record of why. **Step 1** already says DNS before any image build because `VITE_API_URL` is baked in; it now also says: set the two repository variables before the first push that should produce a deployable image. **Step 5** describes pull-not-build. § Sizing implications records that 8 GB is valid *because* builds are off-box, so that the next reader does not reintroduce an on-box build under it.
- [pre-launch-sweep.md](pre-launch-sweep.md): the DNS + `VITE_API_URL` gate's value now lives in a GitHub Actions variable rather than the box's `.env`; say so in its status line. The "deploy api and web together" standing rule cites this note as the mechanism.
- [error-tracking.md](error-tracking.md): E2b's browser DSN is a build arg, and E3's sourcemap upload runs at image build — both land in the chunk 1 job (a `VITE_SENTRY_DSN` variable, a `SENTRY_AUTH_TOKEN` secret), not in `deploy.sh`. This note is the one that says where the hook is, so the error-tracking note only needs the cross-reference.
- [repo-conventions-web.md](../../repo-conventions-web.md) § container divergence: the probe is now "pull the CI image and run it", which is a stronger probe than a local `docker build` because it is the exact artefact. One sentence in "How to apply".
- [open-work.md](../open-work.md) and [README.md](../README.md) index lines.

Two things the pass turned up beyond the list above, both fixed in the same commit. `hosting.md` named Hetzner in three headings and its Status line, not only in step 0 — the two section headings are vendor-neutral now, and no inbound anchor pointed at either. And `error-tracking.md` argued for hosted Sentry partly from "the 16 GB is budgeted for tenants", which the same sizing change invalidates; the argument survives at 8 GB and reads stronger, but the number had to move.

## Chunk 4 — optional, after launch · not started

- `workflow_dispatch` deploy job: SSH key as a repository secret, runs the same `deploy.sh` from the runner with a chosen tag. Only worth it once branch protection is on and pushes stop being the owner's direct act; until then it is a second way to do the same thing.
- GHCR retention: every `main` push leaves an untagged old `main` manifest and a permanent `sha-*`. Free for a public repo and tens of MB each after layer sharing, so nothing to do at this scale; `actions/delete-package-versions` on a schedule if it ever becomes worth the noise.

## Risks carried, not solved

- **A variable set wrong builds a wrong image that deploys green.** `VITE_API_URL` pointing at dev, or `VITE_SITE_URL` empty (which `envOrigin()` guards against, but only for the empty-string case). The chunk 1 smoke checks that the container boots, not that it points at production. The runbook's post-deploy check remains: load the site, confirm ⌘K opens the palette, count responses ≥ 400, and read the status page's build commit.
- **`.env` on the box drifts from the compose file's `:?` requirements.** Unchanged by this arc — the narrowed rsync still ships `compose.prod.yaml`, so a new required variable still fails loudly at `up`.
- **GHCR is a third party in the deploy path.** If it is down, deploy is blocked but the running stack is unaffected; the `build:` block kept in compose is the manual escape hatch, at the cost of the RAM spike this note exists to avoid. Acceptable for a personal box.
