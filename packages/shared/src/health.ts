// Body of `GET /health`, the liveness probe deploy.sh polls after a rollout.
export interface HealthResponse {
  status: "ok";
}
