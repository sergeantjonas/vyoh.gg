import type {
  RiotMatch,
  RiotMatchParticipantOther,
  RiotMatchParticipantOwner,
  StoredMatch,
} from "../riot/types";

// The MatchDetailCache JSON column holds exactly what projectMatchForStorage
// wrote, so this is the one place aggregations trust the Prisma `Json` to be
// a StoredMatch. They read through it instead of re-declaring the participant
// shape inline — an inline shape can list a field the projection strips from
// teammates and type-check perfectly while reading `undefined`.
export function storedMatchOf(detail: unknown): StoredMatch {
  return detail as StoredMatch;
}

// The participant a row was projected for is stored in full, so it carries
// every Riot field; every other row is the lean RiotMatchParticipantOther.
// Matches on puuid, then rejects a row explicitly flagged lean: the flag is
// absent on rows written before the projection existed (also full), and a
// roster account that was *not* this row's owner is lean and must not be read
// as if it were.
export function ownerParticipant(
  match: StoredMatch,
  puuid: string
): RiotMatchParticipantOwner | undefined {
  const row = match.info.participants.find((p) => p.puuid === puuid);
  if (row === undefined || row.isOwner === false) return undefined;
  return row as RiotMatchParticipantOwner;
}

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
