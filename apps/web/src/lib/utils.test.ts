import { describe, expect, it } from "vitest";
import { cn } from "./utils";

describe("cn", () => {
  it("concatenates space-separated class strings", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("ignores falsy values (null, undefined, false)", () => {
    expect(cn("a", null, undefined, false, "b")).toBe("a b");
  });

  it("merges conflicting tailwind utilities, keeping the later one", () => {
    // tailwind-merge resolves p-2 vs p-4 in favor of the later class.
    expect(cn("p-2", "p-4")).toBe("p-4");
  });

  it("expands conditional object syntax (clsx semantics)", () => {
    expect(cn("a", { active: true, hidden: false })).toBe("a active");
  });
});
