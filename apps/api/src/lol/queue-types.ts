// Thin re-export layer for the api side. The canonical queue metadata lives
// in @vyoh/shared so the web profile/live/library surfaces share one source
// of truth (see docs/repo-conventions.md "Cross-package utilities" rule).
// `queueTypeName` is preserved as an alias of `queueLabel` so existing
// match-mapper / analytics / lol.service call sites stay untouched.
export { RANKED_QUEUE_MAP, queueLabel as queueTypeName } from "@vyoh/shared";
