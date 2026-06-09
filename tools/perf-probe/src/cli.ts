import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { type Browser, type Page, chromium, firefox } from "playwright";
import { INIT_SCRIPT } from "./probe-init-script.js";
import { SCENARIOS, type Scenario, type ScreenshotMoment } from "./scenarios.js";
import { type PhaseMetrics, analysePhase } from "./trace-analyse.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = resolve(__dirname, "../../..");
const RUNS_DIR = join(__dirname, "..", "runs");
const DEV_ORIGIN = process.env.PERF_PROBE_ORIGIN ?? "http://localhost:2009";
const VIEWPORT = { width: 1440, height: 900 };

interface CliArgs {
  scenario: string;
  browser: "chromium" | "firefox";
  compareTo: string | null;
}

function parseArgs(): CliArgs {
  const argv = process.argv.slice(2);
  let scenario: string | null = null;
  let browser: CliArgs["browser"] = "chromium";
  let compareTo: string | null = null;
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--scenario" && argv[i + 1]) {
      scenario = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === "--browser" && argv[i + 1]) {
      const value = argv[i + 1];
      if (value !== "chromium" && value !== "firefox") {
        throw new Error(`Unsupported browser: ${value}`);
      }
      browser = value;
      i += 1;
    } else if (arg === "--compare" && argv[i + 1]) {
      compareTo = argv[i + 1] ?? null;
      i += 1;
    } else if (arg === "--help" || arg === "-h") {
      printUsage();
      process.exit(0);
    }
  }
  if (scenario === null) {
    printUsage();
    process.exit(1);
  }
  return { scenario, browser, compareTo };
}

function printUsage(): void {
  const scenarioNames = SCENARIOS.map((s) => s.name).join(", ");
  console.log(
    [
      "Usage: pnpm --filter @vyoh/tools-perf-probe probe -- --scenario <name> [options]",
      "",
      "Options:",
      `  --scenario <name>    one of: ${scenarioNames}`,
      "  --browser <name>     chromium (default) | firefox",
      "  --compare <run-dir>  diff this run against a previous run directory",
      "",
      "Env:",
      "  PERF_PROBE_ORIGIN    dev-server origin (default: http://localhost:2009)",
    ].join("\n")
  );
}

interface PaintBuckets {
  paint: Array<{ name: string; startTime: number }>;
  lcp: Array<{
    startTime: number;
    renderTime: number | null;
    loadTime: number | null;
    size: number | null;
  }>;
  laf: Array<{
    startTime: number;
    duration: number;
    blockingDuration: number | null;
  }>;
}

interface PhaseRecord {
  label: string;
  durationMs: number;
  compositor: PhaseMetrics;
  screenshot: string;
}

interface RunMetrics {
  scenario: string;
  browser: string;
  startedAt: string;
  origin: string;
  viewport: { width: number; height: number };
  cold: {
    paint: PaintBuckets;
    cdpMetrics: Record<string, number>;
  };
  phases: PhaseRecord[];
  totalDurationMs: number;
}

interface RunArtifacts {
  metrics: RunMetrics;
  traceBytes: Buffer;
  consoleLog: string;
  screenshots: Map<string, Buffer>;
}

async function launchBrowser(
  kind: CliArgs["browser"]
): Promise<{ browser: Browser; page: Page }> {
  const launcher = kind === "firefox" ? firefox : chromium;
  const browser = await launcher.launch({
    args: kind === "chromium" ? ["--enable-gpu-rasterization"] : [],
  });
  const context = await browser.newContext({
    viewport: VIEWPORT,
    deviceScaleFactor: 1,
  });
  await context.addInitScript(INIT_SCRIPT);
  const page = await context.newPage();
  return { browser, page };
}

async function startCDPTrace(page: Page): Promise<{
  stop: () => Promise<{ traceBytes: Buffer; cdpMetrics: Record<string, number> }>;
} | null> {
  // CDP is Chromium-only. Firefox runs without trace; we still capture paint
  // timings + screenshots.
  if (page.context().browser()?.browserType().name() !== "chromium") {
    return null;
  }
  const client = await page.context().newCDPSession(page);
  await client.send("Performance.enable");
  await client.send("Tracing.start", {
    categories: [
      "devtools.timeline",
      "disabled-by-default-cc.debug",
      "disabled-by-default-devtools.timeline",
      "blink.user_timing",
    ].join(","),
    options: "record-as-much-as-possible",
    transferMode: "ReturnAsStream",
  });

  return {
    stop: async () => {
      const tracingComplete = new Promise<string>((resolve) => {
        client.once("Tracing.tracingComplete", (event) => {
          resolve(event.stream ?? "");
        });
      });
      await client.send("Tracing.end");
      const streamHandle = await tracingComplete;
      const chunks: string[] = [];
      while (true) {
        const result = await client.send("IO.read", {
          handle: streamHandle,
          size: 1024 * 1024,
        });
        chunks.push(result.data);
        if (result.eof) break;
      }
      await client.send("IO.close", { handle: streamHandle });
      const traceJson = chunks.join("");
      const perf = await client.send("Performance.getMetrics");
      const cdpMetrics: Record<string, number> = {};
      for (const m of perf.metrics) cdpMetrics[m.name] = m.value;
      await client.detach().catch(() => {});
      return { traceBytes: Buffer.from(traceJson, "utf8"), cdpMetrics };
    },
  };
}

async function settleNetworkIdle(page: Page): Promise<void> {
  // Vite HMR keeps a websocket open, so `networkidle` never resolves. Instead
  // wait for one rAF after document ready as a "first paint settled" signal.
  await page.waitForLoadState("domcontentloaded", { timeout: 30_000 }).catch(() => {});
  await page
    .evaluate(
      () =>
        new Promise<void>((r) => {
          requestAnimationFrame(() => requestAnimationFrame(() => r()));
        })
    )
    .catch(() => {});
}

async function executePhase(
  page: Page,
  scenario: Scenario,
  moment: ScreenshotMoment
): Promise<void> {
  if (moment.phase === "load") {
    await settleNetworkIdle(page);
  } else if (moment.phase === "post-open" && scenario.openSelector) {
    await page
      .locator(scenario.openSelector)
      .first()
      .click({ timeout: 10_000 })
      .catch(() => {});
  } else if (moment.phase === "post-close" && scenario.closeSelector) {
    await page
      .locator(scenario.closeSelector)
      .first()
      .click({ timeout: 10_000 })
      .catch(() => {});
  } else if (moment.phase === "scroll-bottom") {
    await page
      .evaluate(() => {
        const main = document.querySelector("main") ?? document.body;
        main.scrollTo({ top: main.scrollHeight, behavior: "instant" });
      })
      .catch(() => {});
  }
  if (moment.settleMs) {
    await page.waitForTimeout(moment.settleMs);
  }
}

async function readPaintBuckets(page: Page): Promise<PaintBuckets> {
  return await page
    .evaluate(
      () =>
        (window as unknown as { __perfProbe?: { buckets: PaintBuckets } }).__perfProbe
          ?.buckets ?? { paint: [], lcp: [], laf: [] }
    )
    .catch(() => ({ paint: [], lcp: [], laf: [] }));
}

async function runScenario(args: CliArgs): Promise<RunArtifacts> {
  const scenario = SCENARIOS.find((s) => s.name === args.scenario);
  if (!scenario) {
    throw new Error(
      `Unknown scenario: ${args.scenario}. Known: ${SCENARIOS.map((s) => s.name).join(", ")}`
    );
  }
  const startedAt = new Date().toISOString();
  const consoleBuffer: string[] = [];
  const { browser, page } = await launchBrowser(args.browser);
  page.on("console", (m) => consoleBuffer.push(`[${m.type()}] ${m.text()}`));
  page.on("pageerror", (e) => consoleBuffer.push(`[pageerror] ${e.message}`));
  page.on("requestfailed", (r) =>
    consoleBuffer.push(
      `[requestfailed] ${r.url()} — ${r.failure()?.errorText ?? "unknown"}`
    )
  );

  const trace = await startCDPTrace(page);
  // Wall-clock anchor matched to the trace clock. The trace's first event
  // ts is treated as "wallAtTraceStart" so per-phase windows expressed in
  // wall-clock ms can be converted to trace microseconds in analysePhase.
  const wallAtTraceStart = Date.now();
  const startTime = wallAtTraceStart;

  await page.goto(`${DEV_ORIGIN}${scenario.path}`, {
    waitUntil: "commit",
    timeout: 30_000,
  });

  const phaseRecords: PhaseRecord[] = [];
  const phaseScreenshots = new Map<string, Buffer>();
  // Phase windows in wall-clock ms relative to wallAtTraceStart; converted
  // to absolute trace timestamps once the trace is parsed.
  const phaseWindowsWall = new Map<string, { startMs: number; endMs: number }>();
  for (const moment of scenario.screenshotMoments) {
    const phaseStartMs = Date.now() - wallAtTraceStart;
    await executePhase(page, scenario, moment);
    const phaseEndMs = Date.now() - wallAtTraceStart;
    const screenshotName = `${moment.name}.png`;
    const shot = await page.screenshot({ fullPage: false }).catch(() => null);
    if (shot) phaseScreenshots.set(screenshotName, shot);
    phaseRecords.push({
      label: moment.name,
      durationMs: phaseEndMs - phaseStartMs,
      compositor: {
        uniqueLayers: 0,
        layerPushPropertiesEvents: 0,
        droppedFrames: 0,
        rasterTaskTotalMs: 0,
        paintEvents: 0,
        commits: 0,
        longTasks: 0,
      },
      screenshot: screenshotName,
    });
    phaseWindowsWall.set(moment.name, { startMs: phaseStartMs, endMs: phaseEndMs });
  }

  const paintBuckets = await readPaintBuckets(page);
  const traceResult = trace ? await trace.stop() : null;
  const totalDurationMs = Date.now() - startTime;
  await browser.close().catch(() => {});

  if (traceResult) {
    const parsed = JSON.parse(traceResult.traceBytes.toString("utf8")) as {
      traceEvents?: Array<{ ts?: number }>;
    };
    // Anchor: convert wall-clock ms (relative to wallAtTraceStart) into
    // absolute trace ts (microseconds, Chrome's monotonic clock). Metadata
    // events (thread_name etc.) have ts=0; skip them and use the first real
    // (positive) timestamp as the anchor. The wall-clock anchor was captured
    // right after Tracing.start resolved.
    let firstTs = 0;
    for (const e of parsed.traceEvents ?? []) {
      if (e.ts && e.ts > 0) {
        firstTs = e.ts;
        break;
      }
    }
    for (const record of phaseRecords) {
      const window = phaseWindowsWall.get(record.label);
      if (!window) continue;
      record.compositor = analysePhase(parsed as Parameters<typeof analysePhase>[0], {
        startUs: firstTs + window.startMs * 1000,
        endUs: firstTs + window.endMs * 1000,
      });
    }
  }

  const metrics: RunMetrics = {
    scenario: scenario.name,
    browser: args.browser,
    startedAt,
    origin: DEV_ORIGIN,
    viewport: VIEWPORT,
    cold: {
      paint: paintBuckets,
      cdpMetrics: traceResult?.cdpMetrics ?? {},
    },
    phases: phaseRecords,
    totalDurationMs,
  };

  return {
    metrics,
    traceBytes: traceResult?.traceBytes ?? Buffer.alloc(0),
    consoleLog: consoleBuffer.join("\n"),
    screenshots: phaseScreenshots,
  };
}

async function persistRun(args: CliArgs, artifacts: RunArtifacts): Promise<string> {
  const stamp = artifacts.metrics.startedAt.replace(/[:.]/g, "-").replace("T", "_");
  const runDir = join(RUNS_DIR, `${args.scenario}-${args.browser}-${stamp}`);
  const shotDir = join(runDir, "screenshots");
  await mkdir(shotDir, { recursive: true });
  await writeFile(
    join(runDir, "metrics.json"),
    `${JSON.stringify(artifacts.metrics, null, 2)}\n`,
    "utf8"
  );
  if (artifacts.traceBytes.length > 0) {
    await writeFile(join(runDir, "trace.json"), artifacts.traceBytes);
  }
  await writeFile(join(runDir, "console.log"), artifacts.consoleLog, "utf8");
  for (const [name, bytes] of artifacts.screenshots) {
    await writeFile(join(shotDir, name), bytes);
  }
  return runDir;
}

async function compare(latestDir: string, baselineDir: string): Promise<string> {
  const latest = JSON.parse(
    await readFile(join(latestDir, "metrics.json"), "utf8")
  ) as RunMetrics;
  const baseline = JSON.parse(
    await readFile(join(baselineDir, "metrics.json"), "utf8")
  ) as RunMetrics;
  const lines: string[] = [];
  lines.push(`# Compare: ${latest.scenario} (${latest.browser})`);
  lines.push("");
  lines.push(`- Baseline: \`${baselineDir.replace(REPO_ROOT, ".")}\``);
  lines.push(`- Latest:   \`${latestDir.replace(REPO_ROOT, ".")}\``);
  lines.push("");
  lines.push("## Phases");
  lines.push("");
  lines.push(
    "| Phase | Layers Δ | PushProps Δ | Dropped Δ | Raster ms Δ | Paint Δ | Commits Δ |"
  );
  lines.push(
    "|-------|---------:|------------:|----------:|------------:|--------:|----------:|"
  );
  const indexed = new Map(baseline.phases.map((p) => [p.label, p]));
  for (const phase of latest.phases) {
    const base = indexed.get(phase.label);
    if (!base) {
      lines.push(`| ${phase.label} | n/a | n/a | n/a | n/a | n/a | n/a |`);
      continue;
    }
    const l = phase.compositor;
    const b = base.compositor;
    lines.push(
      `| ${phase.label} | ${signed(l.uniqueLayers - b.uniqueLayers)} | ${signed(l.layerPushPropertiesEvents - b.layerPushPropertiesEvents)} | ${signed(l.droppedFrames - b.droppedFrames)} | ${signed(l.rasterTaskTotalMs - b.rasterTaskTotalMs)} | ${signed(l.paintEvents - b.paintEvents)} | ${signed(l.commits - b.commits)} |`
    );
  }
  lines.push("");
  const baselineFcp = baseline.cold.paint.paint.find(
    (e) => e.name === "first-contentful-paint"
  )?.startTime;
  const latestFcp = latest.cold.paint.paint.find(
    (e) => e.name === "first-contentful-paint"
  )?.startTime;
  if (baselineFcp !== undefined && latestFcp !== undefined) {
    lines.push(
      `FCP: ${baselineFcp.toFixed(0)} ms → ${latestFcp.toFixed(0)} ms (Δ ${signed(Math.round(latestFcp - baselineFcp))} ms)`
    );
  }
  const baselineLcp = baseline.cold.paint.lcp.at(-1)?.startTime;
  const latestLcp = latest.cold.paint.lcp.at(-1)?.startTime;
  if (baselineLcp !== undefined && latestLcp !== undefined) {
    lines.push(
      `LCP: ${baselineLcp.toFixed(0)} ms → ${latestLcp.toFixed(0)} ms (Δ ${signed(Math.round(latestLcp - baselineLcp))} ms)`
    );
  }
  return lines.join("\n");
}

function signed(n: number): string {
  return n > 0 ? `+${n}` : `${n}`;
}

async function main(): Promise<void> {
  const args = parseArgs();
  const artifacts = await runScenario(args);
  const runDir = await persistRun(args, artifacts);
  console.log(`Run written: ${runDir}`);
  console.log("");
  for (const phase of artifacts.metrics.phases) {
    console.log(
      `  ${phase.label.padEnd(20)} layers=${phase.compositor.uniqueLayers} pushProps=${phase.compositor.layerPushPropertiesEvents} dropped=${phase.compositor.droppedFrames} raster=${phase.compositor.rasterTaskTotalMs}ms paint=${phase.compositor.paintEvents} commits=${phase.compositor.commits} longTasks=${phase.compositor.longTasks}`
    );
  }
  if (args.compareTo) {
    const report = await compare(runDir, resolve(args.compareTo));
    const reportPath = join(runDir, "compare.md");
    await writeFile(reportPath, `${report}\n`, "utf8");
    console.log("");
    console.log(report);
    console.log(`\nReport written: ${reportPath}`);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
