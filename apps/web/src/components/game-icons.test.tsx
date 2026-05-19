import { render } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  BaronNashorIcon,
  ChemtechDrakeIcon,
  CloudDrakeIcon,
  CrossedSwordsIcon,
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
  TwoCoinsIcon,
  VisionIcon,
  VoidGrubIcon,
} from "./game-icons";

describe("game-icons", () => {
  it("renders the img-based icons (Gold, Kills, Cs) with aria-hidden and a wsrv.nl src", () => {
    const { container } = render(
      <>
        <GoldIcon className="g" />
        <KillsIcon className="k" />
        <CsIcon className="cs" />
      </>
    );
    const imgs = container.querySelectorAll("img");
    expect(imgs.length).toBe(3);
    for (const img of imgs) {
      expect(img.getAttribute("aria-hidden")).toBe("true");
      expect(img.getAttribute("src")).toMatch(/wsrv\.nl/);
    }
    expect(container.querySelector(".g")).not.toBeNull();
    expect(container.querySelector(".k")).not.toBeNull();
    expect(container.querySelector(".cs")).not.toBeNull();
  });

  it.each([
    ["VisionIcon", VisionIcon],
    ["CrossedSwordsIcon", CrossedSwordsIcon],
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
    ["TwoCoinsIcon", TwoCoinsIcon],
  ])("renders %s as an SVG with role=img and aria-hidden", (_, Icon) => {
    const { container } = render(<Icon />);
    const svg = container.querySelector("svg");
    expect(svg).not.toBeNull();
    expect(svg?.getAttribute("role")).toBe("img");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });

  it("forwards SVG props onto the svg element", () => {
    const { container } = render(<VisionIcon className="vision-cls" />);
    expect(container.querySelector(".vision-cls")).not.toBeNull();
  });
});
