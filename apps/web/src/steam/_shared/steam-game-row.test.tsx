import { render } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { SteamGameRowShell } from "./steam-game-row";

describe("SteamGameRowShell", () => {
  it("renders name as the logo alt and meta as visible text", () => {
    const { container, getByAltText } = render(
      <SteamGameRowShell appid={730} name="Counter-Strike 2" meta="120h lifetime" />
    );
    // Name lives on the logo wordmark img's alt — the visible "title" is the
    // logo art itself, with the text fallback only rendering when the logo
    // asset is missing (see the logoFailed branch).
    expect(getByAltText("Counter-Strike 2")).not.toBeNull();
    expect(container.textContent).toContain("120h lifetime");
  });

  it("omits the meta line when meta prop is absent", () => {
    const { container } = render(<SteamGameRowShell appid={440} name="TF2" />);
    // No visible text content at all when meta + trailing are both absent —
    // the only string in the tree is the logo alt, which textContent doesn't
    // include.
    expect(container.textContent?.trim()).toBe("");
  });

  it("renders trailing slot only when provided", () => {
    const { rerender, queryByTestId } = render(
      <SteamGameRowShell appid={570} name="Dota 2" />
    );
    expect(queryByTestId("trailing-marker")).toBeNull();
    rerender(
      <SteamGameRowShell
        appid={570}
        name="Dota 2"
        trailing={<span data-testid="trailing-marker">→</span>}
      />
    );
    expect(queryByTestId("trailing-marker")).not.toBeNull();
  });

  it("attaches heroRef to the cover hero img", () => {
    const ref = createRef<HTMLImageElement>();
    const { container } = render(
      <SteamGameRowShell appid={730} name="CS2" heroRef={ref} />
    );
    // Shell stacks: [cover hero (heroRef), logo]. The hero is the first
    // img — the cover composition has no separate palette backdrop layer.
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBeGreaterThanOrEqual(2);
    expect(ref.current).toBe(imgs[0]);
  });

  it("steers `object-position` from the saliency anchor when provided", () => {
    const { container } = render(
      <SteamGameRowShell
        appid={730}
        name="CS2"
        subjectXPercent={75}
        subjectYPercent={30}
      />
    );
    const hero = container.querySelector("img");
    expect(hero?.style.objectPosition).toBe("75% 30%");
  });

  it("falls back to a 50/50 anchor when subject percents are null", () => {
    const { container } = render(
      <SteamGameRowShell
        appid={730}
        name="CS2"
        subjectXPercent={null}
        subjectYPercent={null}
      />
    );
    const hero = container.querySelector("img");
    expect(hero?.style.objectPosition).toBe("50% 50%");
  });

  it("attaches logoRef to the logo wordmark img", () => {
    const ref = createRef<HTMLImageElement>();
    const { container } = render(
      <SteamGameRowShell appid={730} name="CS2" logoRef={ref} />
    );
    // The logo is the last img in the shell (rendered inside the content
    // overlay on the left). Paired via `steam-game-${appid}-logo`.
    const imgs = container.querySelectorAll("img");
    expect(ref.current).toBe(imgs[imgs.length - 1]);
  });
});
