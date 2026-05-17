import { Injectable, NotFoundException } from "@nestjs/common";
import { formatDuration } from "@vyoh/shared";
import { IdentityService } from "../identity/identity.service";
import { LolService } from "../lol/lol.service";
import { renderMatchCard } from "./og-card";

@Injectable()
export class OgService {
  constructor(
    private readonly lol: LolService,
    private readonly identity: IdentityService
  ) {}

  async generateMatchCard(slug: string, matchId: string): Promise<Buffer> {
    const account = this.identity.findBySlug(slug);
    if (!account) {
      throw new NotFoundException(`No account for slug "${slug}"`);
    }

    const detail = await this.lol.getMatchDetail(matchId);
    const me = detail.participants.find(
      (p) =>
        p.riotIdGameName.toLowerCase() === account.gameName.toLowerCase() &&
        p.riotIdTagline.toLowerCase() === account.tagLine.toLowerCase()
    );
    if (!me) {
      throw new NotFoundException(
        `Participant ${account.gameName}#${account.tagLine} not found in match ${matchId}`
      );
    }

    return renderMatchCard({
      championName: me.championName,
      championAlias: me.championName,
      kills: me.kills,
      deaths: me.deaths,
      assists: me.assists,
      win: me.win,
      queueType: detail.queueType,
      durationLabel: formatDuration(detail.durationSec),
      accountLabel: `${account.gameName}#${account.tagLine}`,
      region: account.region.toUpperCase(),
    });
  }
}
