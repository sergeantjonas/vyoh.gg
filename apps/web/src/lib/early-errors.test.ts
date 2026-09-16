import { describe, expect, it } from "vitest";
import { type EarlyError, bufferEarlyErrors, earlyErrorValue } from "./early-errors";

/** Events are synthesised rather than thrown so the assertions stay on the buffer. */
function errorEvent(error: unknown, message = "boom"): Event {
  return Object.assign(new Event("error"), { error, message });
}

function rejectionEvent(reason: unknown): Event {
  return Object.assign(new Event("unhandledrejection"), { reason });
}

describe("bufferEarlyErrors", () => {
  it("holds errors thrown before the reporter loads", () => {
    const target = new EventTarget();
    const buffer = bufferEarlyErrors(target);
    const boom = new Error("during hydration");

    target.dispatchEvent(errorEvent(boom));

    expect(buffer.drain().map(earlyErrorValue)).toEqual([boom]);
  });

  it("holds unhandled rejections, reporting the reason rather than the event", () => {
    const target = new EventTarget();
    const buffer = bufferEarlyErrors(target);
    const reason = new Error("rejected");

    target.dispatchEvent(rejectionEvent(reason));

    expect(buffer.drain().map(earlyErrorValue)).toEqual([reason]);
  });

  // A failed image or stylesheet fires `error` on window with nothing to report;
  // forwarding those would file noise as an unhandled exception.
  it("ignores a resource-load error, which carries no error to report", () => {
    const target = new EventTarget();
    const buffer = bufferEarlyErrors(target);

    target.dispatchEvent(new Event("error"));

    expect(buffer.drain()).toEqual([]);
  });

  // A cross-origin script is stripped to a message with no `error` object.
  it("falls back to the message when the error object is absent", () => {
    const target = new EventTarget();
    const buffer = bufferEarlyErrors(target);

    target.dispatchEvent(errorEvent(undefined, "Script error."));

    expect(buffer.drain().map(earlyErrorValue)).toEqual(["Script error."]);
  });

  // A crash loop can outpace the chunk request; the first few carry the cause.
  it("stops holding past the limit rather than growing without bound", () => {
    const target = new EventTarget();
    const buffer = bufferEarlyErrors(target, 2);

    for (const n of [1, 2, 3, 4]) target.dispatchEvent(errorEvent(new Error(String(n))));

    expect(
      buffer.drain().map((e: EarlyError) => (earlyErrorValue(e) as Error).message)
    ).toEqual(["1", "2"]);
  });

  it("drains once — a second drain is empty rather than a repeat report", () => {
    const target = new EventTarget();
    const buffer = bufferEarlyErrors(target);
    target.dispatchEvent(errorEvent(new Error("once")));

    buffer.drain();

    expect(buffer.drain()).toEqual([]);
  });

  it("stops listening, so the SDK's own handlers are not shadowed afterwards", () => {
    const target = new EventTarget();
    const buffer = bufferEarlyErrors(target);

    buffer.stop();
    target.dispatchEvent(errorEvent(new Error("after")));

    expect(buffer.drain()).toEqual([]);
  });
});
