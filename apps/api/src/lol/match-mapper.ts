import type {
  MatchDetail,
  MatchSummary,
  ParticipantOwnerExtras,
  TeamSummary,
} from "@vyoh/shared";
import type { RiotMatch, RiotMatchParticipantOwner, StoredMatch } from "../riot/types";
import { queueTypeName } from "./queue-types";

// Rift lane positions where `laneMinionsFirst10Minutes` is a faithful proxy
// for `csAt10`. JUNGLE is excluded — jungle CS comes from camps, not lanes —
// and empty teamPosition (ARAM/URF/Arena) has no lane phase.
const LANE_ROLES = new Set(["TOP", "MIDDLE", "BOTTOM", "UTILITY"]);
function isLaneRole(teamPosition: string): boolean {
  return LANE_ROLES.has(teamPosition);
}

function projectOwnerExtras(p: RiotMatchParticipantOwner): ParticipantOwnerExtras {
  const c = p.challenges;
  return {
    spellCasts: {
      q: p.spell1Casts,
      w: p.spell2Casts,
      e: p.spell3Casts,
      r: p.spell4Casts,
      summoner1: p.summoner1Casts,
      summoner2: p.summoner2Casts,
    },
    multikills: {
      double: p.doubleKills,
      triple: p.tripleKills,
      quadra: p.quadraKills,
      penta: p.pentaKills,
      killingSprees: p.killingSprees,
      largestKillingSpree: p.largestKillingSpree,
    },
    survival: {
      totalDamageTaken: p.totalDamageTaken,
      damageSelfMitigated: p.damageSelfMitigated,
      totalHeal: p.totalHeal,
      totalTimeCCDealt: p.totalTimeCCDealt,
      totalTimeSpentDead: p.totalTimeSpentDead,
      longestTimeSpentLiving: p.longestTimeSpentLiving,
    },
    challenges: {
      ...(c?.soloKills !== undefined ? { soloKills: c.soloKills } : {}),
      ...(c?.outnumberedKills !== undefined
        ? { outnumberedKills: c.outnumberedKills }
        : {}),
      ...(c?.survivedSingleDigitHpCount !== undefined
        ? { survivedSingleDigitHpCount: c.survivedSingleDigitHpCount }
        : {}),
      ...(c?.effectiveHealAndShielding !== undefined
        ? { effectiveHealAndShielding: c.effectiveHealAndShielding }
        : {}),
      ...(c?.enemyChampionImmobilizations !== undefined
        ? { enemyChampionImmobilizations: c.enemyChampionImmobilizations }
        : {}),
      ...(c?.damagePerMinute !== undefined ? { damagePerMinute: c.damagePerMinute } : {}),
      ...(c?.laneMinionsFirst10Minutes !== undefined
        ? { laneMinionsFirst10Minutes: c.laneMinionsFirst10Minutes }
        : {}),
      ...(c?.skillshotsHit !== undefined ? { skillshotsHit: c.skillshotsHit } : {}),
      ...(c?.skillshotsDodged !== undefined
        ? { skillshotsDodged: c.skillshotsDodged }
        : {}),
      ...(c?.maxCsAdvantageOnLaneOpponent !== undefined
        ? { maxCsAdvantageOnLaneOpponent: c.maxCsAdvantageOnLaneOpponent }
        : {}),
      ...(c?.maxLevelLeadLaneOpponent !== undefined
        ? { maxLevelLeadLaneOpponent: c.maxLevelLeadLaneOpponent }
        : {}),
      ...(c?.visionScoreAdvantageLaneOpponent !== undefined
        ? { visionScoreAdvantageLaneOpponent: c.visionScoreAdvantageLaneOpponent }
        : {}),
      ...(c?.dragonTakedowns !== undefined ? { dragonTakedowns: c.dragonTakedowns } : {}),
      ...(c?.baronTakedowns !== undefined ? { baronTakedowns: c.baronTakedowns } : {}),
      ...(c?.riftHeraldTakedowns !== undefined
        ? { riftHeraldTakedowns: c.riftHeraldTakedowns }
        : {}),
      ...(c?.timeCCingOthers !== undefined ? { timeCCingOthers: c.timeCCingOthers } : {}),
    },
  };
}

export function riotMatchToSummary(match: RiotMatch, puuid: string): MatchSummary {
  const participant = match.info.participants.find((p) => p.puuid === puuid);
  if (!participant) {
    throw new Error(`PUUID ${puuid} not found in match ${match.metadata.matchId}`);
  }

  // Damage share is computed against the user's team total — sum just that
  // side instead of using the (heavier) per-team-totals map riotMatchToDetail
  // builds for all participants.
  let teamTotalDamage = 0;
  for (const p of match.info.participants) {
    if (p.teamId === participant.teamId) {
      teamTotalDamage += p.totalDamageDealtToChampions;
    }
  }
  const damageShare =
    teamTotalDamage > 0 ? participant.totalDamageDealtToChampions / teamTotalDamage : 0;

  let laneOpponent: MatchSummary["laneOpponent"] = null;
  if (participant.teamPosition) {
    const opp = match.info.participants.find(
      (p) =>
        p.teamId !== participant.teamId && p.teamPosition === participant.teamPosition
    );
    if (opp) {
      laneOpponent = {
        puuid: opp.puuid,
        championName: opp.championName,
        gameName: opp.riotIdGameName,
        tagLine: opp.riotIdTagline,
      };
    }
  }

  return {
    matchId: match.metadata.matchId,
    queueType: queueTypeName(match.info.queueId),
    champion: participant.championName,
    kills: participant.kills,
    deaths: participant.deaths,
    assists: participant.assists,
    win: participant.win,
    durationSec: match.info.gameDuration,
    playedAt: new Date(match.info.gameStartTimestamp).toISOString(),
    // Riot exposes gameEndedInEarlySurrender on each participant — the field at
    // info-level is not reliably populated (e.g. EUW1_7849561729 returned it
    // only per-participant). Combined with a duration under 3.5 min it
    // reliably identifies remakes (as distinct from mid-game surrenders or the
    // new inting-surrender system).
    remake: participant.gameEndedInEarlySurrender && match.info.gameDuration < 210,
    teamPosition: participant.teamPosition,
    gameVersion: match.info.gameVersion,
    visionScore: participant.visionScore,
    damageShare,
    firstBloodKill: participant.firstBloodKill,
    // PN3: seed csAt10 from the owner's `laneMinionsFirst10Minutes` challenge
    // for lane positions only. Junglers farm camps — their lane-minion count
    // is genuinely ~0, but the timeline-derived csAt10 *includes* jungle camps
    // (see csOf in timeline-summary-mapper). Backfilling a jungler with the
    // lane-minion proxy would silently under-represent their CS. Empty
    // teamPosition (ARAM/URF/Arena) is skipped for the same reason.
    csAt10: isLaneRole(participant.teamPosition)
      ? (participant.challenges?.laneMinionsFirst10Minutes ?? 0)
      : 0,
    hasTimeline: false,
    csAt15: 0,
    goldAt10: 0,
    goldAt15: 0,
    teamGoldDiffAt15: 0,
    teamGoldDiffSeries: [],
    deathTimings: [],
    deathXs: [],
    deathYs: [],
    killTimings: [],
    killXs: [],
    killYs: [],
    laneOpponent,
  };
}

export function extractItems(match: RiotMatch, puuid: string): { items: number[] } {
  const participant = match.info.participants.find((p) => p.puuid === puuid);
  if (!participant) return { items: [] };

  const items = [
    participant.item0,
    participant.item1,
    participant.item2,
    participant.item3,
    participant.item4,
    participant.item5,
  ].filter((id) => id > 0);

  return { items };
}

export function riotMatchToDetail(match: RiotMatch | StoredMatch): MatchDetail {
  const durationMin = match.info.gameDuration / 60;

  // Per-team totals needed for share computations
  const teamTotals = new Map<number, { damage: number; gold: number }>();
  for (const p of match.info.participants) {
    const t = teamTotals.get(p.teamId) ?? { damage: 0, gold: 0 };
    t.damage += p.totalDamageDealtToChampions;
    t.gold += p.goldEarned;
    teamTotals.set(p.teamId, t);
  }

  const teams: TeamSummary[] = match.info.teams.map((t) => {
    const teamParticipants = match.info.participants.filter((p) => p.teamId === t.teamId);
    const totalKills = teamParticipants.reduce((sum, p) => sum + p.kills, 0);
    const totalGold = teamTotals.get(t.teamId)?.gold ?? 0;
    return {
      teamId: t.teamId,
      win: t.win,
      totalKills,
      totalGold,
      objectives: {
        baron: t.objectives.baron,
        champion: t.objectives.champion,
        dragon: t.objectives.dragon,
        inhibitor: t.objectives.inhibitor,
        riftHerald: t.objectives.riftHerald,
        tower: t.objectives.tower,
      },
    };
  });

  const participants = match.info.participants.map((p) => {
    const totals = teamTotals.get(p.teamId) ?? { damage: 1, gold: 1 };
    const keystone = p.perks.styles[0]?.selections[0]?.perk ?? 0;

    // Stored owner participants retain the full Riot payload (see
    // projectMatchForStorage owner branch). Raw RiotMatch input has no isOwner
    // discriminator — we surface owner extras only from StoredMatch.
    const isStoredOwner = "isOwner" in p && p.isOwner === true;
    const owner = isStoredOwner ? projectOwnerExtras(p) : undefined;

    return {
      puuid: p.puuid,
      riotIdGameName: p.riotIdGameName,
      riotIdTagline: p.riotIdTagline,
      championName: p.championName,
      teamId: p.teamId,
      teamPosition: p.teamPosition,
      kills: p.kills,
      deaths: p.deaths,
      assists: p.assists,
      win: p.win,
      items: [p.item0, p.item1, p.item2, p.item3, p.item4, p.item5, p.item6],
      goldEarned: p.goldEarned,
      totalDamage: p.totalDamageDealtToChampions,
      csTotal: p.totalMinionsKilled + p.neutralMinionsKilled,
      csPerMin:
        Math.round(((p.totalMinionsKilled + p.neutralMinionsKilled) / durationMin) * 10) /
        10,
      visionScore: p.visionScore,
      wardsPlaced: p.wardsPlaced,
      wardsKilled: p.wardsKilled,
      controlWardsPurchased: p.detectorWardsPlaced,
      kp: p.challenges?.killParticipation ?? 0,
      damageShare: totals.damage > 0 ? p.totalDamageDealtToChampions / totals.damage : 0,
      goldShare: totals.gold > 0 ? p.goldEarned / totals.gold : 0,
      damageDealtPhysical: p.physicalDamageDealtToChampions,
      damageDealtMagic: p.magicDamageDealtToChampions,
      damageDealtTrue: p.trueDamageDealtToChampions,
      summoner1Id: p.summoner1Id,
      summoner2Id: p.summoner2Id,
      keystone,
      championLevel: p.champLevel,
      ...(owner !== undefined ? { owner } : {}),
    };
  });

  return {
    matchId: match.metadata.matchId,
    queueType: queueTypeName(match.info.queueId),
    durationSec: match.info.gameDuration,
    playedAt: new Date(match.info.gameStartTimestamp).toISOString(),
    teams,
    participants,
  };
}
