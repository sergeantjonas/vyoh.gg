import { describe, expect, it, vi } from "vitest";
import type { LolAnalyticsService } from "./lol-analytics.service";
import { LolController } from "./lol.controller";
import type { LolService } from "./lol.service";

function makeController() {
  const lol = {
    getMatchesForSummoner: vi.fn(),
    getCachedMatches: vi.fn(),
    syncForSummoner: vi.fn(),
    getSummonerProfile: vi.fn(),
    getRankHistory: vi.fn(),
    subscribeToMatchEvents: vi.fn(),
    getLiveGame: vi.fn(),
    subscribeLiveEvents: vi.fn(),
  };
  const analytics = {
    getDuos: vi.fn(),
    getChronotype: vi.fn(),
    getChampionPairs: vi.fn(),
    getChampionBuildFlow: vi.fn(),
    getChampionExtras: vi.fn(),
    getPregameCalibration: vi.fn(),
  };
  return {
    controller: new LolController(
      lol as unknown as LolService,
      analytics as unknown as LolAnalyticsService
    ),
    lol,
    analytics,
  };
}

const params = { region: "euw1", gameName: "Vyoh", tagLine: "EUW" };
const championParams = { ...params, championKey: "ahri" };

describe("LolController endpoint delegations", () => {
  it("getCachedMatches forwards params/start/count/queue to lol.getCachedMatches", async () => {
    const { controller, lol } = makeController();
    await controller.getCachedMatches(params, 10, 50, 420);
    expect(lol.getCachedMatches).toHaveBeenCalledWith("euw1", "Vyoh", "EUW", 10, 50, 420);
  });

  it("syncMatches delegates to lol.syncForSummoner", async () => {
    const { controller, lol } = makeController();
    await controller.syncMatches(params);
    expect(lol.syncForSummoner).toHaveBeenCalledWith("euw1", "Vyoh", "EUW");
  });

  it("getRank delegates to lol.getSummonerProfile", async () => {
    const { controller, lol } = makeController();
    await controller.getRank(params);
    expect(lol.getSummonerProfile).toHaveBeenCalledWith("euw1", "Vyoh", "EUW");
  });

  it("getDuos delegates to analytics.getDuos with the count query", async () => {
    const { controller, analytics } = makeController();
    await controller.getDuos(params, 100);
    expect(analytics.getDuos).toHaveBeenCalledWith("euw1", "Vyoh", "EUW", 100);
  });

  it("getChronotype delegates to analytics.getChronotype", async () => {
    const { controller, analytics } = makeController();
    await controller.getChronotype(params, 500);
    expect(analytics.getChronotype).toHaveBeenCalledWith("euw1", "Vyoh", "EUW", 500);
  });

  it("getChampionPairs delegates to analytics.getChampionPairs", async () => {
    const { controller, analytics } = makeController();
    await controller.getChampionPairs(params, 100);
    expect(analytics.getChampionPairs).toHaveBeenCalledWith("euw1", "Vyoh", "EUW", 100);
  });

  it("getChampionBuildFlow delegates to analytics.getChampionBuildFlow", async () => {
    const { controller, analytics } = makeController();
    await controller.getChampionBuildFlow(championParams, 100);
    expect(analytics.getChampionBuildFlow).toHaveBeenCalledWith(
      "euw1",
      "Vyoh",
      "EUW",
      "ahri",
      100
    );
  });

  it("getRankHistory delegates to lol.getRankHistory with optional days", async () => {
    const { controller, lol } = makeController();
    await controller.getRankHistory(params, 30);
    expect(lol.getRankHistory).toHaveBeenCalledWith("euw1", "Vyoh", "EUW", 30);
  });

  it("getChampionExtras delegates to analytics.getChampionExtras", async () => {
    const { controller, analytics } = makeController();
    await controller.getChampionExtras(championParams, undefined);
    expect(analytics.getChampionExtras).toHaveBeenCalledWith(
      "euw1",
      "Vyoh",
      "EUW",
      "ahri",
      undefined
    );
  });

  it("matchEvents delegates to lol.subscribeToMatchEvents", async () => {
    const { controller, lol } = makeController();
    await controller.matchEvents(params);
    expect(lol.subscribeToMatchEvents).toHaveBeenCalledWith("euw1", "Vyoh", "EUW");
  });

  it("getLiveGame delegates to lol.getLiveGame", async () => {
    const { controller, lol } = makeController();
    await controller.getLiveGame(params);
    expect(lol.getLiveGame).toHaveBeenCalledWith("euw1", "Vyoh", "EUW");
  });

  it("liveEvents delegates to lol.subscribeLiveEvents", async () => {
    const { controller, lol } = makeController();
    await controller.liveEvents(params);
    expect(lol.subscribeLiveEvents).toHaveBeenCalledWith("euw1", "Vyoh", "EUW");
  });

  it("getPregameCalibration parses CSV queueIds and forwards them", async () => {
    const { controller, analytics } = makeController();
    await controller.getPregameCalibration(params, "420,440");
    expect(analytics.getPregameCalibration).toHaveBeenCalledWith(
      "euw1",
      "Vyoh",
      "EUW",
      [420, 440]
    );
  });

  it("getPregameCalibration forwards undefined when queueIds is omitted", async () => {
    const { controller, analytics } = makeController();
    await controller.getPregameCalibration(params, undefined);
    expect(analytics.getPregameCalibration).toHaveBeenCalledWith(
      "euw1",
      "Vyoh",
      "EUW",
      undefined
    );
  });
});
