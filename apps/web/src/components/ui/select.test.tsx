import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

// Radix Select mounts its content subtree even while closed, so the grouping
// primitives render without driving the trigger open — which happy-dom cannot
// do reliably anyway.
describe("Select grouping primitives", () => {
  it("renders group, label and separator inside the content subtree", () => {
    render(
      <Select defaultValue="matches">
        <SelectTrigger>
          <SelectValue placeholder="Pick a tab" />
        </SelectTrigger>
        <SelectContent>
          <SelectGroup>
            <SelectLabel>Sections</SelectLabel>
            <SelectItem value="matches">Matches</SelectItem>
            <SelectSeparator />
            <SelectItem value="trends">Trends</SelectItem>
          </SelectGroup>
        </SelectContent>
      </Select>
    );
    expect(screen.getByRole("combobox")).toBeTruthy();
  });
});
