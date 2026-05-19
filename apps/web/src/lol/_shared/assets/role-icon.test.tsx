import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ROLE_LABEL, RoleIcon, isRolePosition, rolePositionIconUrl } from "./role-icon";

describe("RoleIcon", () => {
  it("renders an img with the proxy URL for the position", () => {
    render(<RoleIcon position="MIDDLE" />);
    const img = screen.getByRole("img", { name: "Mid" }) as HTMLImageElement;
    expect(img.getAttribute("src")).toContain("/img/lol/role/middle.svg");
  });

  it("uses the explicit title prop for alt when provided", () => {
    render(<RoleIcon position="TOP" title="Top lane" />);
    expect(screen.getByRole("img", { name: "Top lane" })).toBeTruthy();
  });

  it("falls back to a hand-rolled svg if the img errors", () => {
    const { container } = render(<RoleIcon position="JUNGLE" />);
    fireEvent.error(container.querySelector("img") as HTMLImageElement);
    expect(container.querySelector("svg")).toBeTruthy();
    expect(screen.getByRole("img", { name: "Jungle" })).toBeTruthy();
  });
});

describe("role-icon helpers", () => {
  it("ROLE_LABEL maps every supported position", () => {
    expect(ROLE_LABEL.TOP).toBe("Top");
    expect(ROLE_LABEL.JUNGLE).toBe("Jungle");
    expect(ROLE_LABEL.MIDDLE).toBe("Mid");
    expect(ROLE_LABEL.BOTTOM).toBe("Bot");
    expect(ROLE_LABEL.UTILITY).toBe("Support");
  });

  it("isRolePosition rejects unknown strings", () => {
    expect(isRolePosition("TOP")).toBe(true);
    expect(isRolePosition("INVALID")).toBe(false);
    expect(isRolePosition("")).toBe(false);
  });

  it("rolePositionIconUrl maps each role to its slug", () => {
    expect(rolePositionIconUrl("TOP")).toContain("/img/lol/role/top.svg");
    expect(rolePositionIconUrl("UTILITY")).toContain("/img/lol/role/utility.svg");
  });
});
