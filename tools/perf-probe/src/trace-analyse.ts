// Pulls the metrics that the panel-arc diagnosis used (layer count,
// UpdateLayer events, DroppedFrame events, RasterTask time, Paint events)
// out of a raw Chrome devtools-timeline trace. Mirrors the table shape in
// docs/working-notes/cross-cutting/panel-compositor-load.md so before/after
// comparisons read with the same vocabulary.

// Empirically derived from a real Chrome 137 devtools.timeline +
// disabled-by-default-cc.debug trace (see panel-compositor-load.md for the
// arc that produced the original numbers, and tools/perf-probe/runs/ for
// today's calibration trace). Names and args shapes are sensitive to Chrome
// version — verify before bumping Chromium in the Playwright pin.
interface TraceEvent {
  name?: string;
  ph?: string;
  ts?: number;
  dur?: number;
  cat?: string;
  args?: {
    data?: { layerId?: number | string };
    tileData?: { layerId?: number | string };
  };
}

interface TraceFile {
  traceEvents?: TraceEvent[];
}

export interface PhaseWindow {
  // Inclusive start timestamp in microseconds (Chrome trace native unit).
  startUs: number;
  // Inclusive end timestamp; if missing, the phase runs to the end of trace.
  endUs?: number;
}

export interface PhaseMetrics {
  // Distinct layer IDs observed via Paint + RasterTask events in the window.
  // Lower bound: a layer that wasn't repainted in the window doesn't appear.
  // In practice mid-transition windows expose almost every layer carrying
  // animated content, which is what we care about.
  uniqueLayers: number;
  // Number of times the compositor pushed updated properties to a layer.
  // Sensitive proxy for "layer churn" — high counts mean the compositor
  // tree is being mutated heavily during the window.
  layerPushPropertiesEvents: number;
  // Frames the compositor dropped (or partially dropped) during the window.
  droppedFrames: number;
  // Total milliseconds in RasterTask events (tile rasterization on the
  // raster worker pool). Sensitive to layer area + complexity.
  rasterTaskTotalMs: number;
  // Number of Paint events fired in the window.
  paintEvents: number;
  // Number of compositor Commit events. Each commit is one tree-push to GPU.
  commits: number;
  // RunTasks longer than 50ms — matches the browser's long-task threshold.
  longTasks: number;
}

function pickLayerId(event: TraceEvent): number | string | undefined {
  // Paint events carry the layer ID under args.data.layerId.
  const data = event.args?.data?.layerId;
  if (data !== undefined) return data;
  // RasterTask events carry it under args.tileData.layerId.
  return event.args?.tileData?.layerId;
}

function eventInWindow(event: TraceEvent, window: PhaseWindow): boolean {
  if (event.ts === undefined) return false;
  if (event.ts < window.startUs) return false;
  if (window.endUs !== undefined && event.ts > window.endUs) return false;
  return true;
}

export function analysePhase(trace: TraceFile, window: PhaseWindow): PhaseMetrics {
  const events = trace.traceEvents ?? [];
  const seenLayers = new Set<number | string>();
  let layerPushPropertiesEvents = 0;
  let droppedFrames = 0;
  let rasterTaskTotalUs = 0;
  let commits = 0;
  let paintEvents = 0;
  let longTasks = 0;

  for (const event of events) {
    if (!eventInWindow(event, window)) continue;
    const name = event.name ?? "";

    if (name === "Paint" || name === "RasterTask") {
      const layerId = pickLayerId(event);
      if (layerId !== undefined) seenLayers.add(layerId);
    }
    if (name === "Paint") paintEvents += 1;
    if (name === "Layer::PushPropertiesTo") layerPushPropertiesEvents += 1;
    if (name === "DroppedFrame" || name === "PartialDroppedFrame") {
      droppedFrames += 1;
    }
    if (name === "RasterTask") rasterTaskTotalUs += event.dur ?? 0;
    if (name === "Commit") commits += 1;
    if (name === "RunTask" && (event.dur ?? 0) > 50_000) longTasks += 1;
  }

  return {
    uniqueLayers: seenLayers.size,
    layerPushPropertiesEvents,
    droppedFrames,
    rasterTaskTotalMs: Math.round(rasterTaskTotalUs / 1000),
    paintEvents,
    commits,
    longTasks,
  };
}
