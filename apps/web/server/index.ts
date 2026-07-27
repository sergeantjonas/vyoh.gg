import { access } from "node:fs/promises";
import { join } from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
import { type FetchHandler, createNodeServer } from "./node-adapter.ts";

/**
 * Production entry for the web tier. Run directly as TypeScript
 * (`node server/index.ts`) — Node ≥ 22.18 strips types without a flag, and
 * `erasableSyntaxOnly` in `tsconfig.node.json` is what keeps this file inside
 * what stripping can handle. The api already depends on the same mechanism to
 * `require()` `@vyoh/shared`'s raw source, so this adds no new constraint on
 * the runtime.
 *
 * Both build outputs are resolved relative to this file, so the container can
 * set any working directory.
 */

const APP_ROOT = join(import.meta.dirname, "..");
const CLIENT_DIR = join(APP_ROOT, "dist", "client");
const SERVER_ENTRY = join(APP_ROOT, "dist", "server", "server.js");

async function assertBuilt(path: string): Promise<void> {
  try {
    await access(path);
  } catch {
    throw new Error(
      `Missing build output at ${path}. Run \`pnpm --filter @vyoh/web build\` first.`
    );
  }
}

await assertBuilt(SERVER_ENTRY);
await assertBuilt(CLIENT_DIR);

// Computed specifier: the bundle only exists after a build, so a static import
// would be unresolvable at typecheck time.
const bundle = (await import(pathToFileURL(SERVER_ENTRY).href)) as {
  default: { fetch: FetchHandler };
};

const port = Number(process.env.PORT ?? 2009);
// Containers need the wildcard bind; the published port is loopback-only, so
// this is not a public listen.
const host = process.env.HOST ?? "0.0.0.0";

const server = createNodeServer({ fetch: bundle.default.fetch, clientDir: CLIENT_DIR });

server.listen(port, host, () => {
  console.log(`web listening on http://${host}:${port}`);
});

// `docker stop` sends SIGTERM. Without a handler Node ignores it under PID 1
// and the daemon waits out its 10s grace period on every deploy.
for (const signal of ["SIGTERM", "SIGINT"] as const) {
  process.on(signal, () => {
    console.log(`web received ${signal}, closing`);
    server.close(() => process.exit(0));
  });
}
