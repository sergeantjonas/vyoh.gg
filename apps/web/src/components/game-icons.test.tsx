import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  BaronNashorIcon,
  ChemtechDrakeIcon,
  CloudDrakeIcon,
  CsIcon,
  ElderDragonIcon,
  FireDrakeIcon,
  GoldIcon,
  HextechDrakeIcon,
  InhibitorIcon,
  KillsIcon,
  MountainDrakeIcon,
  OceanDrakeIcon,
  RiftHeraldIcon,
  TowerIcon,
  VisionIcon,
  VoidGrubIcon,
} from "./game-icons";

describe("game-icons", () => {
  it("renders the img-based icons (Gold, Kills, Cs, Vision) with aria-hidden and a proxy src", () => {
    const { container } = render(
      <>
        <GoldIcon className="g" />
        <KillsIcon className="k" />
        <CsIcon className="cs" />
        <VisionIcon className="v" />
      </>
    );
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBe(4);
    for (const img of imgs) {
      expect(img.getAttribute("aria-hidden")).toBe("true");
      // Each UI icon now routes through the proxy: /img/lol/ui/:name.webp
      expect(img.getAttribute("src")).toMatch(/\/img\/lol\/ui\/[a-z]+\.webp$/);
    }
    expect(container.querySelector(".g")).not.toBeNull();
    expect(container.querySelector(".k")).not.toBeNull();
    expect(container.querySelector(".cs")).not.toBeNull();
    expect(container.querySelector(".v")).not.toBeNull();
  });

  it.each([
    ["VoidGrubIcon", VoidGrubIcon],
    ["HextechDrakeIcon", HextechDrakeIcon],
    ["ChemtechDrakeIcon", ChemtechDrakeIcon],
    ["TowerIcon", TowerIcon],
    ["BaronNashorIcon", BaronNashorIcon],
    ["FireDrakeIcon", FireDrakeIcon],
    ["CloudDrakeIcon", CloudDrakeIcon],
    ["RiftHeraldIcon", RiftHeraldIcon],
    ["OceanDrakeIcon", OceanDrakeIcon],
    ["InhibitorIcon", InhibitorIcon],
    ["ElderDragonIcon", ElderDragonIcon],
    ["MountainDrakeIcon", MountainDrakeIcon],
  ])("renders %s as an SVG with role=img and aria-hidden", (_, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });
});
