import { type ReactElement, type ReactNode, isValidElement } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// main.tsx renders the production tree into #root on import. To assert the
// MotionConfig wrapping without actually booting the router, mock createRoot
// so we capture the JSX passed to .render() and walk it for the wrapper.

const renderMock = vi.fn();
const createRootMock = vi.fn(() => ({ render: renderMock, unmount: vi.fn() }));

vi.mock("react-dom/client", () => ({ createRoot: createRootMock }));
vi.mock("@tanstack/react-router", () => ({
  RouterProvider: () => null,
  createRouter: () => ({}),
}));
vi.mock("./routeTree.gen", () => ({ routeTree: {} }));
vi.mock("./lib/web-vitals", () => ({ reportWebVitals: () => undefined }));

function findElementByType(node: ReactNode, displayName: string): ReactElement | null {
  if (!node || typeof node !== "object") return null;
  if (Array.isArray(node)) {
    for (const child of node) {
      const hit = findElementByType(child, displayName);
      if (hit) return hit;
    }
    return null;
  }
  if (!isValidElement(node)) return null;
  const type = node.type as { displayName?: string; name?: string } | string;
  const typeName = typeof type === "string" ? type : (type.displayName ?? type.name);
  if (typeName === displayName) return node;
  const children = (node.props as { children?: ReactNode }).children;
  return findElementByType(children, displayName);
}

describe("main entry", () => {
  beforeEach(() => {
    document.body.innerHTML = '<div id="root"></div>';
    vi.resetModules();
    renderMock.mockReset();
    createRootMock.mockClear();
  });

  afterEach(() => {
    document.body.innerHTML = "";
  });

  it("wraps the router in a MotionConfig with reducedMotion='user'", async () => {
    await import("./main");

    expect(createRootMock).toHaveBeenCalledTimes(1);
    expect(renderMock).toHaveBeenCalledTimes(1);

    const tree = renderMock.mock.calls[0]?.[0] as ReactNode;
    const motionConfig = findElementByType(tree, "MotionConfig");

    expect(motionConfig).not.toBeNull();
    expect((motionConfig?.props as { reducedMotion?: string }).reducedMotion).toBe(
      "user"
    );
  });
});
