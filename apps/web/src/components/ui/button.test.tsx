import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { Button, buttonVariants } from "./button";

describe("Button", () => {
  it("renders a native <button> by default", () => {
    render(<Button>Hello</Button>);
    const btn = screen.getByRole("button", { name: "Hello" });
    expect(btn.tagName).toBe("BUTTON");
    expect(btn.getAttribute("data-slot")).toBe("button");
    expect(btn.getAttribute("data-variant")).toBe("default");
    expect(btn.getAttribute("data-size")).toBe("default");
  });

  it("renders a Slot when asChild is true so the child element is the root", () => {
    render(
      <Button asChild>
        <a href="/x">go</a>
      </Button>
    );
    const link = screen.getByRole("link", { name: "go" });
    expect(link.tagName).toBe("A");
    expect(link.getAttribute("data-slot")).toBe("button");
  });

  it("merges variant and size into the className tokens", () => {
    render(
      <Button variant="outline" size="sm">
        x
      </Button>
    );
    const btn = screen.getByRole("button");
    expect(btn.getAttribute("data-variant")).toBe("outline");
    expect(btn.getAttribute("data-size")).toBe("sm");
    expect(btn.className).toContain("border-border");
  });

  it("appends the consumer className", () => {
    render(<Button className="custom-token">x</Button>);
    expect(screen.getByRole("button").className).toContain("custom-token");
  });

  it("buttonVariants returns a class string for default variant/size", () => {
    const cls = buttonVariants({});
    expect(typeof cls).toBe("string");
    expect(cls.length).toBeGreaterThan(0);
  });
});
