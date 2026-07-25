import {
  NavigationMenu,
  NavigationMenuIndicator,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuViewport,
} from "@/components/ui/navigation-menu";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// NavigationMenu renders its own viewport internally, but both the viewport
// and the indicator are exported for callers that need to place them
// explicitly. Nothing in the app does yet, so they need direct exercise.
describe("NavigationMenu optional slots", () => {
  it("renders an explicitly placed viewport and indicator", () => {
    render(
      <NavigationMenu>
        <NavigationMenuList>
          <NavigationMenuItem>
            <NavigationMenuLink href="/lol">LoL</NavigationMenuLink>
          </NavigationMenuItem>
          <NavigationMenuIndicator />
        </NavigationMenuList>
        <NavigationMenuViewport />
      </NavigationMenu>
    );
    expect(screen.getByRole("link", { name: "LoL" })).toBeTruthy();
  });
});
