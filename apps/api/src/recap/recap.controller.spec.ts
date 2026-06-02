import type { RecapChapterDescriptor } from "@vyoh/shared";
import { describe, expect, it, vi } from "vitest";

import type { RecapSubjectsService } from "./recap-subjects.service";
import { RecapController } from "./recap.controller";

describe("RecapController.getChapters", () => {
  it("wraps the selector output in the `chapters` envelope", async () => {
    const fake: RecapChapterDescriptor[] = [
      {
        kind: "steam-subject",
        slug: "steam-42",
        appid: 42,
        name: "Test",
        score: 40,
        daysSince: 0,
        ageBucket: "current",
        framing: null,
      },
    ];
    const subjects = {
      getChapters: vi.fn().mockResolvedValue(fake),
    } as unknown as RecapSubjectsService;
    const controller = new RecapController(subjects);
    await expect(controller.getChapters()).resolves.toEqual({ chapters: fake });
  });
});
