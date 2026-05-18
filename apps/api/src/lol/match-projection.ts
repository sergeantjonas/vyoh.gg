import type { RiotMatch, RiotMatchParticipantOther, StoredMatch } from "../riot/types";

export function projectMatchForStorage(
  raw: RiotMatch,
  ownerPuuids: Set<string>
): StoredMatch {
  const { participants: _, ...infoRest } = raw.info;

  return {
    metadata: raw.metadata,
    info: {
      ...infoRest,
      participants: raw.info.participants.map((p) => {
        if (ownerPuuids.has(p.puuid)) return { ...p, isOwner: true as const };

        const firstStyle = p.perks.styles[0];
        const keystoneSelection = firstStyle?.selections[0];

        const lean: RiotMatchParticipantOther = {
          isOwner: false,
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
          item0: p.item0,
          item1: p.item1,
          item2: p.item2,
          item3: p.item3,
          item4: p.item4,
          item5: p.item5,
          item6: p.item6,
          goldEarned: p.goldEarned,
          totalDamageDealtToChampions: p.totalDamageDealtToChampions,
          physicalDamageDealtToChampions: p.physicalDamageDealtToChampions,
          magicDamageDealtToChampions: p.magicDamageDealtToChampions,
          trueDamageDealtToChampions: p.trueDamageDealtToChampions,
          totalMinionsKilled: p.totalMinionsKilled,
          neutralMinionsKilled: p.neutralMinionsKilled,
          visionScore: p.visionScore,
          wardsPlaced: p.wardsPlaced,
          wardsKilled: p.wardsKilled,
          detectorWardsPlaced: p.detectorWardsPlaced,
          summoner1Id: p.summoner1Id,
          summoner2Id: p.summoner2Id,
          champLevel: p.champLevel,
          perks: {
            styles:
              firstStyle !== undefined
                ? [
                    {
                      selections:
                        keystoneSelection !== undefined ? [keystoneSelection] : [],
                    },
                  ]
                : [],
          },
          ...(p.challenges !== undefined
            ? {
                challenges:
                  p.challenges.killParticipation !== undefined
                    ? { killParticipation: p.challenges.killParticipation }
                    : {},
              }
            : {}),
        };
        return lean;
      }),
    },
  };
}
