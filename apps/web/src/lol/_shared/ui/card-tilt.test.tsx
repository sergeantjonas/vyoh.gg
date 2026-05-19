import { fireEvent, render, screen } from "@testing-library/react";
import { MotionConfig } from "motion/react";
import { describe, expect, it } from "vitest";
import { CardTilt } from "./card-tilt";

describe("CardTilt", () => {
  it("renders children", () => {
    render(
      <MotionConfig reducedMotion="never">
        <CardTilt>
          <span>tilt-child</span>
        </CardTilt>
      </MotionConfig>
    );
    expect(screen.getByText("tilt-child")).toBeTruthy();
  });

  it("applies the className to the motion shell when motion is enabled", () => {
    const { container } = render(
      <MotionConfig reducedMotion="never">
        <CardTilt className="tilt-shell">
          <span>tilt-child</span>
        </CardTilt>
      </MotionConfig>
    );
    expect(container.querySelector(".tilt-shell")).toBeTruthy();
  });

  it("handles mouse move and leave without throwing", () => {
    const { container } = render(
      <MotionConfig reducedMotion="never">
        <CardTilt>
          <span>x</span>
        </CardTilt>
      </MotionConfig>
    );
    const shell = container.firstElementChild as HTMLElement;
    fireEvent.mouseMove(shell, { clientX: 10, clientY: 10 });
    fireEvent.mouseLeave(shell);
    expect(shell).toBeTruthy();
  });
});
