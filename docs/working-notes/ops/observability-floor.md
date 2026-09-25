# Observability floor — seeing into the box before it serves traffic

**Status:** Active — **found 2026-09-12 during the pre-deploy index review, and it is a launch gate the sweep did not have.** Every other gate in [pre-launch-sweep.md](pre-launch-sweep.md) asks whether the app is *correct* on first contact with the public. This one asks whether anyone will *know* when it stops being correct. The app has never run anywhere but a dev box, so its production failure modes are entirely unobserved; shipping without a way to see them means the first incident is discovered by looking at the site, not by being told. **Chunk 1 shipped 2026-09-13** — container log caps, the one real gap in `compose.prod.yaml`. A second finding raised alongside it, that the api had no healthcheck and the prod stack therefore could not start, was **refuted on review and is recorded below** rather than deleted. Chunk 2 was the real remaining gate, **scoped 2026-09-13** into [error-tracking.md](error-tracking.md), which makes the hosted-versus-self-hosted call, and **closed with E3's sourcemap upload** (running on every `main` build by 2026-09-23). Chunk 3 unparks an item whose own trigger has fired.

Why this was invisible to the existing indices: the error-tracking item sits in [vnext-ideas.md § Foundational](../cross-cutting/vnext-ideas.md) under a heading that opens "Cherry-pick when the appetite for visible work is exhausted", which is exactly the wrong shelf for something the same line then calls "Required for any public deployment". The logging item is in [parked.md](../parked.md) with a trigger rather than a date. Neither index was wrong; the item just had no home that sorts by launch risk.

## Chunk 1 — container log caps · ✅ shipped 2026-09-13

Found by reading [compose.prod.yaml](../../../compose.prod.yaml) directly rather than from any note.

**No log rotation.** All three services declare `restart: unless-stopped` and none declared a `logging:` block, so each used Docker's default `json-file` driver with no `max-size` or `max-file`, growing without bound until the disk filled. On 160 GB that is slow, which is exactly the problem: it surfaces months after the deploy that caused it, on a box nobody is tailing, and presents as the api crash-looping rather than as a log problem. Fixed with a shared `x-logging` anchor — `json-file`, 10m x 5 per service, roughly 150 MB across the stack, and rotated files stay readable by `docker compose logs`.

### Refuted — "the api has no healthcheck, so the prod stack cannot start"

Recorded rather than deleted, so it is not re-derived. The claim: `web` declares `depends_on: api: condition: service_healthy`, `api` had no `healthcheck:` key, and Compose refuses that pairing at `up` with `container ... has no healthcheck configured`. That would have failed the first deploy on a box bought to receive it.

**It is false.** [apps/api/Dockerfile](../../../apps/api/Dockerfile) and [apps/web/Dockerfile](../../../apps/web/Dockerfile) have both declared image-level `HEALTHCHECK` instructions since 2026-07-27, and Compose reads a container's health state without caring whether it came from the image or the compose file. The image is also the better home for them: those checks resolve their port from `PORT`, where a compose-level copy has to restate it and can drift. `deploy.sh` consults the same endpoints in its post-deploy smoke check.

**Why the error was made, because the shape recurs.** A two-service probe *did* reproduce the refusal — against `alpine` images declaring no `HEALTHCHECK` at all. That is generic Compose behaviour, not this stack's. The probe faithfully answered a question whose fixture did not match the system, and `ugrep HEALTHCHECK apps/*/Dockerfile` would have settled it in one command before any probe was written. **A probe that models the system instead of using it can only confirm the assumption baked into the model; check the real artefact first.** The standing lesson in [repo-conventions.md](../../repo-conventions.md) about verifying a claim against the code before acting on it applies to probes too, not just to prose.

## Chunk 2 — error tracking · the actual gate

The failure mode was never that errors go unhandled — they are caught, at seven sites that already existed — it is that they were **unobserved**, and the first weeks of a system's real life are when its unknown failure modes all arrive at once. **The api half shipped 2026-09-14** and reports through a shared scrubber, inert until `SENTRY_DSN` is set. The web half and the sourcemap pipeline are what remain.

**Analysis, decision and plan: [error-tracking.md](error-tracking.md)**, scoped 2026-09-13. Hosted Sentry over self-hosting and why that is a cheap decision to revisit, seven hook points, the redaction problem that makes this the one chunk capable of *re-opening* F-5 if done carelessly, the missing sourcemap pipeline that would otherwise make the web half worthless, and four chunks. This section remains the gate; that note is the work.

Note the interaction with the parked runtime-validation item ([parked.md § Runtime validation](../parked.md)): that item's trigger is "a real payload-shape incident", and without error tracking a payload-shape incident is exactly the kind of thing that happens without ever being noticed. Error tracking is therefore the cheaper half of that pair and should land first — it converts the silent crash into a reported one, which is the evidence the validation decision was always waiting on. **Runtime validation stays parked; this does not unpark it.**

## Chunk 3 — structured logging and request correlation (A3) · week one

[parked.md](../parked.md) parks API audit A3 (Pino plus request ids) with the trigger **"the app is hosted"**, on the reasoning that structured logs only pay off once they are aggregated. That trigger fires the day the box exists. It is listed third rather than first because it is a genuine piece of work across the api rather than a config line, and because chunk 2 delivers the larger share of the visibility for far less effort. Landing it in the first week post-deploy honours the trigger without holding up launch. Detail: [audit-api-structure.md § A3](../cross-cutting/audit-api-structure.md).

## Adjacent, deliberately not in scope here

- **No HSTS header.** [deploy/nginx/](../../../deploy/nginx/) sets `X-Content-Type-Options`, `Referrer-Policy`, `X-Frame-Options` and `server_tokens off`, and the absent CSP is a recorded decision in `vyoh.gg.conf`. `Strict-Transport-Security` is simply not there. It belongs with the nginx config at deploy time, not with observability, and wants a short `max-age` first because a long one is hard to walk back. Tracked in [security.md](security.md).
- **Web Vitals dashboard and the RUM backend** are post-launch by an explicit 2026-09-06 decision in [vnext-ideas.md](../cross-cutting/vnext-ideas.md): before launch the only visitor is the owner's dev box, so there is nothing to plot. This note does not disturb that sequencing — error tracking answers "did it break", RUM answers "how fast is it for real people", and only the first is a launch gate.
