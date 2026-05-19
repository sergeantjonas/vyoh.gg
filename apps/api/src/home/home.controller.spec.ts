import { describe, expect, it, vi } from "vitest";
import type { HomeChronotypeService } from "./home-chronotype.service";
import type { HomeDaySplitService } from "./home-day-split.service";
import type { HomeFirstPlayedService } from "./home-first-played.service";
import type { HomeSessionLengthsService } from "./home-session-lengths.service";
import type { HomeWeeklyTotalsService } from "./home-weekly-totals.service";
import { HomeController } from "./home.controller";

function makeController() {
  const chronotype = { getChronotype: vi.fn().mockResolvedValue({ buckets: [] }) };
  const weekly = { getWeeklyTotals: vi.fn().mockResolvedValue({ totals: [] }) };
  const first = { getFirstPlayed: vi.fn().mockResolvedValue({ kind: "none" }) };
  const day = { getDaySplit: vi.fn().mockResolvedValue({ weekday: 0, weekend: 0 }) };
  const sessions = { getSessionLengths: vi.fn().mockResolvedValue({ buckets: [] }) };
  return {
    controller: new HomeController(
      chronotype as unknown as HomeChronotypeService,
      weekly as unknown as HomeWeeklyTotalsService,
      first as unknown as HomeFirstPlayedService,
      day as unknown as HomeDaySplitService,
      sessions as unknown as HomeSessionLengthsService
    ),
    chronotype,
    weekly,
    first,
    day,
    sessions,
  };
}

describe("HomeController", () => {
  it("getChronotype forwards count to the service", async () => {
    const { controller, chronotype } = makeController();
    await controller.getChronotype(100);
    expect(chronotype.getChronotype).toHaveBeenCalledWith(100);
  });

  it("getWeeklyTotals delegates to the weekly-totals service", async () => {
    const { controller, weekly } = makeController();
    await controller.getWeeklyTotals();
    expect(weekly.getWeeklyTotals).toHaveBeenCalled();
  });

  it("getFirstPlayed delegates to the first-played service", async () => {
    const { controller, first } = makeController();
    await controller.getFirstPlayed();
    expect(first.getFirstPlayed).toHaveBeenCalled();
  });

  it("getDaySplit delegates to the day-split service", async () => {
    const { controller, day } = makeController();
    await controller.getDaySplit();
    expect(day.getDaySplit).toHaveBeenCalled();
  });

  it("getSessionLengths delegates to the session-lengths service", async () => {
    const { controller, sessions } = makeController();
    await controller.getSessionLengths();
    expect(sessions.getSessionLengths).toHaveBeenCalled();
  });
});
