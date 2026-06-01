import { render } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { AtmosphereProvider } from "./atmosphere-provider";
import { __resetAtmosphereOwnerSeqForTests } from "./use-atmosphere-claim";

describe("AtmosphereProvider", () => {
  beforeEach(() => {
    __resetAtmosphereOwnerSeqForTests();
  });

  it("renders children and mounts the atmosphere layer in document.body", () => {
    const { getByTestId, unmount } = render(
      <AtmosphereProvider>
        <div data-testid="child">content</div>
      </AtmosphereProvider>
    );
    expect(getByTestId("child")).toBeTruthy();
    // The layer is portalled to document.body, so it doesn't appear in the
    // container — query the body directly.
    expect(document.body.querySelector("[data-atmosphere-layer]")).not.toBeNull();
    unmount();
    expect(document.body.querySelector("[data-atmosphere-layer]")).toBeNull();
  });
});
