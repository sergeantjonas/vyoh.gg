import type {
  MatchTimelineBuildEvent,
  MatchTimelineKill,
  MatchTimelineObjective,
  MatchTimelineProjection,
  MatchTimelineSkillEvent,
} from "@vyoh/shared";
import type { RiotMatchTimeline } from "../riot/types";

const DRAGON_SUBTYPE_MAP: Record<string, string> = {
  FIRE_DRAGON: "DRAGON_FIRE",
  WATER_DRAGON: "DRAGON_OCEAN",
  EARTH_DRAGON: "DRAGON_MOUNTAIN",
  AIR_DRAGON: "DRAGON_CLOUD",
  HEXTECH_DRAGON: "DRAGON_HEXTECH",
  CHEMTECH_DRAGON: "DRAGON_CHEMTECH",
  ELDER_DRAGON: "DRAGON_ELDER",
};

export function riotTimelineToProjection(
  timeline: RiotMatchTimeline
): MatchTimelineProjection {
  const kills: MatchTimelineKill[] = [];
  const objectives: MatchTimelineObjective[] = [];
  const buildOrderMap = new Map<number, MatchTimelineBuildEvent[]>();
  const skillOrderMap = new Map<number, MatchTimelineSkillEvent[]>();

  const frames = timeline.info.frames.map((frame) => {
    for (const event of frame.events) {
      switch (event.type) {
        case "CHAMPION_KILL":
          if (event.killerId !== undefined && event.victimId !== undefined) {
            kills.push({
              ts: event.timestamp,
              killerId: event.killerId,
              victimId: event.victimId,
              assistIds: event.assistingParticipantIds ?? [],
              position: event.position ?? null,
            });
          }
          break;
        case "ITEM_PURCHASED":
          if (event.participantId !== undefined && event.itemId !== undefined) {
            const arr = buildOrderMap.get(event.participantId) ?? [];
            arr.push({ ts: event.timestamp, type: "PURCHASED", itemId: event.itemId });
            buildOrderMap.set(event.participantId, arr);
          }
          break;
        case "ITEM_SOLD":
          if (event.participantId !== undefined && event.itemId !== undefined) {
            const arr = buildOrderMap.get(event.participantId) ?? [];
            arr.push({ ts: event.timestamp, type: "SOLD", itemId: event.itemId });
            buildOrderMap.set(event.participantId, arr);
          }
          break;
        case "ITEM_UNDO":
          // beforeId > 0 means an item was purchased and is being undone
          if (
            event.participantId !== undefined &&
            event.beforeId !== undefined &&
            event.beforeId > 0
          ) {
            const arr = buildOrderMap.get(event.participantId) ?? [];
            arr.push({ ts: event.timestamp, type: "UNDO", itemId: event.beforeId });
            buildOrderMap.set(event.participantId, arr);
          }
          break;
        case "SKILL_LEVEL_UP":
          // EVOLVE events are Kayn/Viktor-style ability mutations, not level-ups
          if (
            event.participantId !== undefined &&
            event.skillSlot !== undefined &&
            event.levelUpType !== "EVOLVE" &&
            event.skillSlot >= 1 &&
            event.skillSlot <= 4
          ) {
            const arr = skillOrderMap.get(event.participantId) ?? [];
            arr.push({ ts: event.timestamp, slot: event.skillSlot as 1 | 2 | 3 | 4 });
            skillOrderMap.set(event.participantId, arr);
          }
          break;
        case "ELITE_MONSTER_KILL": {
          const teamId = event.killerTeamId ?? 0;
          let type: string;
          if (event.monsterType === "DRAGON") {
            type = DRAGON_SUBTYPE_MAP[event.monsterSubType ?? ""] ?? "DRAGON_UNKNOWN";
          } else if (event.monsterType === "BARON_NASHOR") {
            type = "BARON_NASHOR";
          } else if (event.monsterType === "RIFTHERALD") {
            type = "RIFT_HERALD";
          } else {
            type = event.monsterType ?? "UNKNOWN";
          }
          objectives.push({
            ts: event.timestamp,
            type,
            teamId,
            position: event.position ?? null,
          });
          break;
        }
        case "BUILDING_KILL": {
          // event.teamId is the building OWNER; flip to get the team that TOOK it
          const ownerTeam = event.teamId ?? 0;
          const killerTeam = ownerTeam === 100 ? 200 : ownerTeam === 200 ? 100 : 0;
          const type =
            event.buildingType === "INHIBITOR_BUILDING" ? "INHIBITOR" : "TOWER";
          objectives.push({
            ts: event.timestamp,
            type,
            teamId: killerTeam,
            position: event.position ?? null,
          });
          break;
        }
      }
    }

    const perParticipant: MatchTimelineProjection["frames"][number]["perParticipant"] =
      {};
    for (const pf of Object.values(frame.participantFrames)) {
      perParticipant[pf.participantId] = {
        gold: pf.totalGold,
        level: pf.level,
        cs: (pf.minionsKilled ?? 0) + (pf.jungleMinionsKilled ?? 0),
        position: pf.position,
      };
    }

    return { ts: frame.timestamp, perParticipant };
  });

  // Fall back to metadata.participants (puuids in participantId order) when
  // info.participants is absent (older timeline format or test fixtures).
  const participants: MatchTimelineProjection["participants"] = timeline.info.participants
    ?.length
    ? timeline.info.participants
    : timeline.metadata.participants.map((puuid, i) => ({
        participantId: i + 1,
        puuid,
      }));

  return {
    matchId: timeline.metadata.matchId,
    frameIntervalMs: timeline.info.frameInterval,
    participants,
    frames,
    kills,
    objectives,
    buildOrders: [...buildOrderMap.entries()].map(([participantId, events]) => ({
      participantId,
      events,
    })),
    skillOrders: [...skillOrderMap.entries()].map(([participantId, slots]) => ({
      participantId,
      slots,
    })),
  };
}
