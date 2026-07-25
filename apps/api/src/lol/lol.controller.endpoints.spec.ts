import { describe, expect, it, vi } from "vitest";
import type { LolAnalyticsService } from "./lol-analytics.service";
import type { LolChampionAnalyticsService } from "./lol-champion-analytics.service";
import { LolController } from "./lol.controller";
import type { LolService } from "./lol.service";
import type { MatchBaselineService } from "./match-baseline.service";
import type { MatchNarrativeService } from "./match-narrative.service";

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
    getSquads: vi.fn(),
    getChronotype: vi.fn(),
    getChampionPairs: vi.fn(),
    getCarryProfile: vi.fn(),
    getObjectiveFirsts: vi.fn(),
    getObjectiveParticipation: vi.fn(),
    getAramProfile: vi.fn(),
    getDamageProfile: vi.fn(),
    getPregameCalibration: vi.fn(),
  };
  // Champion-scoped routes resolve against the second analytics service. Note
  // that `getChampionDamageProfile` is NOT one of them — it is the account-level
  // getDamageProfile with a championKey filled in, so it still hits `analytics`.
  const championAnalytics = {
    getChampionBuildFlow: vi.fn(),
    getChampionExtras: vi.fn(),
    getChampionRecap: vi.fn(),
    getChampionRuneDiversity: vi.fn(),
    getChampionLanePhase: vi.fn(),
  };
  const baseline = { getBaseline: vi.fn() };
  const narrative = { getNarrativeWindow: vi.fn(), getLifetimeNarrative: vi.fn() };
  return {
    controller: new LolController(
      lol as unknown as LolService,
      analytics as unknown as LolAnalyticsService,
      baseline as unknown as MatchBaselineService,
      narrative as unknown as MatchNarrativeService,
      championAnalytics as unknown as LolChampionAnalyticsService
    ),
    lol,
    analytics,
    championAnalytics,
    baseline,
    narrative,
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

  it("getChampionBuildFlow delegates to championAnalytics.getChampionBuildFlow", async () => {
    const { controller, championAnalytics } = makeController();
    await controller.getChampionBuildFlow(championParams, 100);
    expect(championAnalytics.getChampionBuildFlow).toHaveBeenCalledWith(
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

  it("getChampionExtras delegates to championAnalytics.getChampionExtras", async () => {
    const { controller, championAnalytics } = makeController();
    await controller.getChampionExtras(championParams, undefined);
    expect(championAnalytics.getChampionExtras).toHaveBeenCalledWith(
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

  // region/gameName/tagLine are all `string`, so any reordering among them is
  // invisible to the compiler — the argument assertions below are what catch it.
  it("getSquads delegates to analytics.getSquads", async () => {
    const { controller, analytics } = makeController();
    await controller.getSquads(params, 100);
    expect(analytics.getSquads).toHaveBeenCalledWith("euw1", "Vyoh", "EUW", 100);
  });

  it("getCarryProfile delegates to analytics.getCarryProfile", async () => {
    const { controller, analytics } = makeController();
    await controller.getCarryProfile(params, 100);
    expect(analytics.getCarryProfile).toHaveBeenCalledWith("euw1", "Vyoh", "EUW", 100);
  });

  it("getObjectiveFirsts delegates to analytics.getObjectiveFirsts", async () => {
    const { controller, analytics } = makeController();
    await controller.getObjectiveFirsts(params, 100);
    expect(analytics.getObjectiveFirsts).toHaveBeenCalledWith("euw1", "Vyoh", "EUW", 100);
  });

  it("getObjectiveParticipation delegates to analytics.getObjectiveParticipation", async () => {
    const { controller, analytics } = makeController();
    await controller.getObjectiveParticipation(params, 100);
    expect(analytics.getObjectiveParticipation).toHaveBeenCalledWith(
      "euw1",
      "Vyoh",
      "EUW",
      100
    );
  });

  it("getAramProfile delegates to analytics.getAramProfile", async () => {
    const { controller, analytics } = makeController();
    await controller.getAramProfile(params, 100);
    expect(analytics.getAramProfile).toHaveBeenCalledWith("euw1", "Vyoh", "EUW", 100);
  });

  // The account-scoped route passes no championKey, so the 4th positional
  // argument is undefined — the champion-scoped route below fills it in.
  it("getDamageProfile delegates with an undefined championKey", async () => {
    const { controller, analytics } = makeController();
    await controller.getDamageProfile(params, 100);
    expect(analytics.getDamageProfile).toHaveBeenCalledWith(
      "euw1",
      "Vyoh",
      "EUW",
      undefined,
      100
    );
  });

  it("getChampionDamageProfile delegates to the same service method with the championKey", async () => {
    const { controller, analytics } = makeController();
    await controller.getChampionDamageProfile(championParams, 100);
    expect(analytics.getDamageProfile).toHaveBeenCalledWith(
      "euw1",
      "Vyoh",
      "EUW",
      "ahri",
      100
    );
  });

  it("getChampionRuneDiversity delegates to championAnalytics.getChampionRuneDiversity", async () => {
    const { controller, championAnalytics } = makeController();
    await controller.getChampionRuneDiversity(championParams, 100);
    expect(championAnalytics.getChampionRuneDiversity).toHaveBeenCalledWith(
      "euw1",
      "Vyoh",
      "EUW",
      "ahri",
      100
    );
  });

  it("getChampionLanePhase delegates to championAnalytics.getChampionLanePhase", async () => {
    const { controller, championAnalytics } = makeController();
    await controller.getChampionLanePhase(championParams, 100);
    expect(championAnalytics.getChampionLanePhase).toHaveBeenCalledWith(
      "euw1",
      "Vyoh",
      "EUW",
      "ahri",
      100
    );
  });

  // No count query on this route — the DTO declares params only.
  it("getChampionRecap delegates to championAnalytics.getChampionRecap without a count", async () => {
    const { controller, championAnalytics } = makeController();
    await controller.getChampionRecap(championParams);
    expect(championAnalytics.getChampionRecap).toHaveBeenCalledWith(
      "euw1",
      "Vyoh",
      "EUW",
      "ahri"
    );
  });

  it("getChampionExtras parses CSV queues and drops non-numeric entries", async () => {
    const { controller, championAnalytics } = makeController();
    await controller.getChampionExtras(championParams, "420,nope,440");
    expect(championAnalytics.getChampionExtras).toHaveBeenCalledWith(
      "euw1",
      "Vyoh",
      "EUW",
      "ahri",
      [420, 440]
    );
  });

  it("getBaseline delegates to baseline.getBaseline with the champion and role", async () => {
    const { controller, baseline } = makeController();
    await controller.getBaseline({
      ...params,
      championAlias: "Ahri",
      role: "MIDDLE",
    });
    expect(baseline.getBaseline).toHaveBeenCalledWith(
      "euw1",
      "Vyoh",
      "EUW",
      "Ahri",
      "MIDDLE"
    );
  });

  it("getNarrativeLifetime delegates to narrative.getLifetimeNarrative", async () => {
    const { controller, narrative } = makeController();
    await controller.getNarrativeLifetime(params);
    expect(narrative.getLifetimeNarrative).toHaveBeenCalledWith("euw1", "Vyoh", "EUW");
  });
});
