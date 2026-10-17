# Both production images, built by the `images` job in .github/workflows/ci.yml.
# One bake builds them in the same builder at once, so the api's cache import and
# export overlap the web's Vite build instead of queueing behind it.
#
# Tags, labels and the GHCR names come from docker/metadata-action, whose bake
# files fill in the empty `api-meta` and `web-meta` targets below. The build-arg
# values come from the environment of the step that runs the bake.

variable "VITE_API_URL" {}
variable "VITE_SITE_URL" {}
variable "BUILD_COMMIT" {}
variable "VITE_SENTRY_DSN" {}
variable "VITE_SENTRY_SAMPLE_RATE" {}
variable "SENTRY_ORG" {}

target "api-meta" {}
target "web-meta" {}

group "default" {
  targets = ["api", "web"]
}

# linux/amd64 only: the box is x86, and buildx sets the Dockerfiles'
# TARGETARCH from this. A multi-arch matrix buys nothing until a second box
# exists and costs a QEMU build of Prisma and Sharp every push.
target "api" {
  inherits   = ["api-meta"]
  context    = "."
  dockerfile = "apps/api/Dockerfile"
  platforms  = ["linux/amd64"]
  cache-from = ["type=gha,scope=api"]
  cache-to   = ["type=gha,scope=api,mode=max"]
}

target "web" {
  inherits   = ["web-meta"]
  context    = "."
  dockerfile = "apps/web/Dockerfile"
  platforms  = ["linux/amd64"]
  # BUILD_COMMIT is a build arg here and a runtime env for the api: Vite bakes
  # it into the bundle, so the web tier cannot read it from compose.
  args = {
    VITE_API_URL            = VITE_API_URL
    VITE_SITE_URL           = VITE_SITE_URL
    BUILD_COMMIT            = BUILD_COMMIT
    VITE_SENTRY_DSN         = VITE_SENTRY_DSN
    VITE_SENTRY_SAMPLE_RATE = VITE_SENTRY_SAMPLE_RATE
    SENTRY_ORG              = SENTRY_ORG
  }
  # Sourcemap upload. A secret mount rather than a build arg: an ARG is readable
  # via `docker history` on an anonymously pullable package.
  secret     = ["id=sentry_auth_token,env=SENTRY_AUTH_TOKEN"]
  cache-from = ["type=gha,scope=web"]
  cache-to   = ["type=gha,scope=web,mode=max"]
}
