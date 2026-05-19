import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "./dialog";

describe("Dialog", () => {
  it("renders nothing when closed", () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>Title</DialogTitle>
          <DialogDescription>Desc</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    expect(screen.queryByText("Title")).toBeNull();
  });

  it("opens the dialog when the trigger is clicked", () => {
    render(
      <Dialog>
        <DialogTrigger>Open</DialogTrigger>
        <DialogContent>
          <DialogTitle>The title</DialogTitle>
          <DialogDescription>The description</DialogDescription>
        </DialogContent>
      </Dialog>
    );
    fireEvent.click(screen.getByText("Open"));
    expect(screen.getByText("The title")).toBeTruthy();
    expect(screen.getByText("The description")).toBeTruthy();
    expect(screen.getByRole("dialog")).toBeTruthy();
    expect(screen.getByText("Close")).toBeTruthy();
  });

  it("opens by default when defaultOpen is true", () => {
    render(
      <Dialog defaultOpen>
        <DialogContent aria-describedby={undefined}>
          <DialogTitle>Always</DialogTitle>
        </DialogContent>
      </Dialog>
    );
    expect(screen.getByText("Always")).toBeTruthy();
  });
});
