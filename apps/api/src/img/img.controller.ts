import { Controller, Get, Header, Headers, HttpStatus, Param, Res } from "@nestjs/common";
import type { Response } from "express";
import {
  CHAMPION_CLASS_SLUGS,
  type ChampionClassSlug,
  type ChampionVariant,
  LolImageService,
  ROLE_POSITION_SLUGS,
  type RolePositionSlug,
  UI_ICON_NAMES,
  type UiIconName,
} from "./lol-image.service";
import { SteamImageService } from "./steam-image.service";
import {
  type TranscodeParams,
  UpstreamError,
  fetchUpstreamChain,
  streamUpstream,
  transcodeToWebp,
} from "./upstream";

const IMMUTABLE_YEAR = "public, max-age=31536000, immutable";

// Description-block extras: content-hashed `<hash>.poster.avif` posters and
// `<hash>.webm` clips Steam emits inline in `about_the_game` HTML. The hash
// IS the cache key (Steam regenerates the hash on republish), so a 7-day
// cache is conservative — most assets are immutable for the life of the
// game's marketing page.
const DESCRIPTION_ASSET_CACHE = "public, max-age=604800";
// `<32-hex-hash>` for both webm + avif, with an optional `.poster` subext
// before `.avif`. Anchored to keep the path-traversal surface zero — no
// directory separators, no `..`, no querystring sneaking in via `:asset`.
const DESCRIPTION_ASSET_RE = /^[a-f0-9]{32}(?:\.poster)?\.(webm|avif|png|jpg|jpeg)$/;
const DESCRIPTION_CONTENT_TYPES: Record<string, string> = {
  webm: "video/webm",
  avif: "image/avif",
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
};
const STEAM_STORE_ASSETS_BASE =
  "https://shared.akamai.steamstatic.com/store_item_assets/steam/apps";

// Microtrailer (6-second silent loop) lives at
// `store_item_assets/steam/apps/{appid}/{movieid}/{hash}/microtrailer.{webm|mp4}`.
// The movieid and hash segments are publisher-stable and embed cache-buster
// identity (Steam regenerates them on republish), so a long Cache-Control is
// safe. Same 7-day window as description-asset.
const MICROTRAILER_CACHE = "public, max-age=604800";
const MICROTRAILER_SEGMENT_RE = /^[A-Za-z0-9_-]+$/;
const MICROTRAILER_CONTENT_TYPES: Record<string, string> = {
  webm: "video/webm",
  mp4: "video/mp4",
};
// Trailer poster (the still rendered before/under the `<video>`) — same CDN
// prefix, comes from `trailers.highlights[0].screenshot_medium`. Observed
// shape: `{appid}/extras/{name}.{jpg|jpeg|png}` (typically
// `launch_trailer_medium.jpg`). The name segment allows the limited extra
// chars Steam uses ([A-Za-z0-9_.-]); the bucket is fixed to `extras` so the
// surface stays narrow.
const MICROTRAILER_POSTER_NAME_RE = /^[A-Za-z0-9_-]+\.(jpg|jpeg|png)$/;
const MICROTRAILER_POSTER_CONTENT_TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
};

const CHAMPION_VARIANTS = new Set<ChampionVariant>(["square", "card", "backdrop"]);
const ROLE_POSITIONS = new Set<RolePositionSlug>(ROLE_POSITION_SLUGS);
const UI_ICONS = new Set<UiIconName>(UI_ICON_NAMES);
const CHAMPION_CLASSES = new Set<ChampionClassSlug>(CHAMPION_CLASS_SLUGS);

@Controller("img")
export class ImgController {
  constructor(
    private readonly lol: LolImageService,
    private readonly steam: SteamImageService
  ) {}

  // LoL champion icon/splash variants. `:patch` is a browser cache key only —
  // the proxy ignores its value because CDragon serves "latest" under a single
  // stable URL. Future Riot CDN swaps shift the cached file under the same key.
  @Get("lol/champion/:alias/:variant/:patch.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async champion(
    @Param("alias") alias: string,
    @Param("variant") variant: string,
    @Res() res: Response
  ): Promise<void> {
    if (!CHAMPION_VARIANTS.has(variant as ChampionVariant)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.lol.champion(alias, variant as ChampionVariant);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  @Get("lol/item/:itemId/:patch.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async item(
    @Param("itemId") itemId: string,
    @Param("patch") patch: string,
    @Res() res: Response
  ): Promise<void> {
    const id = Number.parseInt(itemId, 10);
    if (!Number.isFinite(id)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.lol.item(id, patch);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  @Get("lol/profile-icon/:iconId/:patch.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async profileIcon(
    @Param("iconId") iconId: string,
    @Param("patch") patch: string,
    @Res() res: Response
  ): Promise<void> {
    const id = Number.parseInt(iconId, 10);
    if (!Number.isFinite(id)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.lol.profileIcon(id, patch);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  // Wiki-sourced ability icon proxy. Identity comes from the bundle
  // (`championId`, `slot`, `abilityIndex`); the resolver reads the matching
  // Prisma row and builds the wiki URL from champion + ability name.
  // `:patch` is a browser cache key only.
  @Get("lol/ability/:championId/:slot/:abilityIndex/:patch.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async ability(
    @Param("championId") championId: string,
    @Param("slot") slot: string,
    @Param("abilityIndex") abilityIndex: string,
    @Res() res: Response
  ): Promise<void> {
    const cid = Number.parseInt(championId, 10);
    const idx = Number.parseInt(abilityIndex, 10);
    if (!Number.isFinite(cid) || !Number.isFinite(idx)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    let resolved: Awaited<ReturnType<LolImageService["ability"]>>;
    try {
      resolved = await this.lol.ability(cid, slot, idx);
    } catch {
      res.status(HttpStatus.NOT_FOUND).send();
      return;
    }
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  // Generic wiki-file proxy — the inline-icon path for rich tooltip
  // descriptions. The route segment carries the bare filename
  // (e.g. `Magic_damage.png.webp`); the resolver re-derives the MediaWiki
  // MD5 bucket dirs. 400 on filenames outside the wiki-safe slug set.
  @Get("lol/wiki-file/:filename.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async wikiFile(
    @Param("filename") filename: string,
    @Res() res: Response
  ): Promise<void> {
    let resolved: ReturnType<LolImageService["wikiFile"]>;
    try {
      resolved = this.lol.wikiFile(filename);
    } catch {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  @Get("lol/rune/:keystoneId/:patch.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async rune(
    @Param("keystoneId") keystoneId: string,
    @Res() res: Response
  ): Promise<void> {
    const id = Number.parseInt(keystoneId, 10);
    if (!Number.isFinite(id)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.lol.rune(id);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  @Get("lol/spell/:spellKey/:patch.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async spell(@Param("spellKey") spellKey: string, @Res() res: Response): Promise<void> {
    const key = Number.parseInt(spellKey, 10);
    if (!Number.isFinite(key)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.lol.spell(key);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  // Minimap art. Wiki-sourced, no fallback chain (wiki is the only host for
  // these). `:mapId` segment is also the cache key.
  @Get("lol/map/:mapId.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async map(@Param("mapId") mapId: string, @Res() res: Response): Promise<void> {
    const id = Number.parseInt(mapId, 10);
    if (!Number.isFinite(id)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    let resolved: ReturnType<LolImageService["map"]>;
    try {
      resolved = this.lol.map(id);
    } catch {
      res.status(HttpStatus.NOT_FOUND).send();
      return;
    }
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  // Ranked tier emblem. `:year` is the cache key — bump it to invalidate
  // when a future emblem redesign lands on the wiki.
  @Get("lol/rank/:tier/:year.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async rankEmblem(
    @Param("tier") tier: string,
    @Param("year") year: string,
    @Res() res: Response
  ): Promise<void> {
    const yearNum = Number.parseInt(year, 10);
    if (!Number.isFinite(yearNum)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = this.lol.rankEmblem(tier, yearNum);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  // UI singleton icons (gold, cs, vision, kills). Closed set on `:name`.
  @Get("lol/ui/:name.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async uiIcon(@Param("name") name: string, @Res() res: Response): Promise<void> {
    if (!UI_ICONS.has(name as UiIconName)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = this.lol.uiIcon(name as UiIconName);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  // Role-position icon. Versionless — the underlying art changes too rarely
  // to warrant a cache-key segment. Wiki PNG primary with CDragon SVG fallback;
  // Sharp transcodes both into WebP so the format matches the other LoL assets.
  @Get("lol/role/:position.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", "public, max-age=86400")
  async role(@Param("position") position: string, @Res() res: Response): Promise<void> {
    if (!ROLE_POSITIONS.has(position as RolePositionSlug)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = this.lol.role(position as RolePositionSlug);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  // Champion-class archetype icon (fighter/mage/tank/etc.). Closed slug set
  // matches DDragon's legacy 6 tags; versionless cache key — Riot's modern
  // class taxonomy changes too rarely to encode in the URL.
  @Get("lol/class/:slug.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", "public, max-age=86400")
  async champClass(@Param("slug") slug: string, @Res() res: Response): Promise<void> {
    if (!CHAMPION_CLASSES.has(slug as ChampionClassSlug)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = this.lol.champClass(slug as ChampionClassSlug);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  @Get("steam/capsule/:appid/:assetTimestamp.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async steamCapsule(@Param("appid") appid: string, @Res() res: Response): Promise<void> {
    const id = Number.parseInt(appid, 10);
    if (!Number.isFinite(id)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.steam.capsule(id);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  @Get("steam/library-capsule/:appid/:assetTimestamp.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async steamLibraryCapsule(
    @Param("appid") appid: string,
    @Res() res: Response
  ): Promise<void> {
    const id = Number.parseInt(appid, 10);
    if (!Number.isFinite(id)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.steam.libraryCapsule(id);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  // `flip` segment ("flip" | "noflip") bakes a horizontal mirror into the
  // hero bytes when set, so Chrome's view-transition snapshot of the
  // morphing img is already flipped at the pixel level. CSS-only
  // `transform: scaleX(-1)` works for the static DOM but is stripped from
  // VT snapshots — see SteamSubjectAnchorService and the row shell for
  // the rationale, and the consumer at steam-image.ts (`steamLibraryHeroUrl`).
  @Get("steam/hero/:flip/:appid/:assetTimestamp.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async steamHero(
    @Param("appid") appid: string,
    @Param("flip") flip: string,
    @Res() res: Response
  ): Promise<void> {
    const id = Number.parseInt(appid, 10);
    if (!Number.isFinite(id)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.steam.hero(id);
    if (flip === "flip") resolved.params = { ...resolved.params, flop: true };
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  // `:schemaVersion` segment exists purely as a browser cache key — the
  // proxy ignores it. Bumping it on the web side (steam-image.ts) forces
  // a re-fetch past any year-cached immutable bytes when the logo pipeline
  // changes (resize params, trim, etc.). See `LOGO_SCHEMA_VERSION` there.
  @Get("steam/logo/:schemaVersion/:appid/:assetTimestamp.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async steamLogo(@Param("appid") appid: string, @Res() res: Response): Promise<void> {
    const id = Number.parseInt(appid, 10);
    if (!Number.isFinite(id)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.steam.logo(id);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  // `:schemaVersion` is a static cache-bust segment — bump it client-side
  // (via `BACKDROP_SCHEMA_VERSION` in steam-image.ts) when the proxy's
  // upstream chain changes preference (e.g. v1 → v2 was the swap from the
  // dim/blue v6b variant to the warmer `page_bg_generated.jpg`). Without
  // this, existing browsers keep serving year-cached v1 bytes from the
  // immutable Cache-Control header.
  // `:flip` ("flip" | "noflip") same as the hero route — bakes a
  // horizontal mirror into the bytes so the route VT crossfade matches
  // the flipped hero (see `steamLibraryHeroUrl` for the rationale).
  @Get("steam/backdrop/:schemaVersion/:flip/:appid/:assetTimestamp.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async steamBackdrop(
    @Param("appid") appid: string,
    @Param("flip") flip: string,
    @Res() res: Response
  ): Promise<void> {
    const id = Number.parseInt(appid, 10);
    if (!Number.isFinite(id)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.steam.backdrop(id);
    if (flip === "flip") resolved.params = { ...resolved.params, flop: true };
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  @Get("steam/achievement/:appid/:apiName/:schemaVersion.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async steamAchievement(
    @Param("appid") appid: string,
    @Param("apiName") apiName: string,
    @Res() res: Response
  ): Promise<void> {
    const id = Number.parseInt(appid, 10);
    if (!Number.isFinite(id)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.steam.achievement(id, apiName);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  @Get("steam/achievement-gray/:appid/:apiName/:schemaVersion.webp")
  @Header("Content-Type", "image/webp")
  @Header("Cache-Control", IMMUTABLE_YEAR)
  async steamAchievementGray(
    @Param("appid") appid: string,
    @Param("apiName") apiName: string,
    @Res() res: Response
  ): Promise<void> {
    const id = Number.parseInt(appid, 10);
    if (!Number.isFinite(id)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const resolved = await this.steam.achievementGray(id, apiName);
    await this.proxyWebp(resolved.urls, resolved.params, res);
  }

  // Streaming proxy for description-block inline assets: WebM clips and AVIF
  // posters Steam emits in the rendered `about_the_game` HTML. Range-aware
  // because `<video>` scrubbing depends on 206 Partial Content; the route
  // pipes the upstream body straight to the response without buffering, and
  // forwards the upstream `Content-Range` / `Content-Length` headers so the
  // client sees a faithful HTTP response. Cache-Control is set per-route at
  // 7 days because the hash IS the cache key — content-hashed asset paths
  // change when Steam regenerates them, so the upstream `?t=` cache-buster
  // adds nothing here.
  @Get("steam/desc/:appid/extras/:asset")
  @Header("Cache-Control", DESCRIPTION_ASSET_CACHE)
  async steamDescriptionAsset(
    @Param("appid") appid: string,
    @Param("asset") asset: string,
    @Headers("range") range: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    const id = Number.parseInt(appid, 10);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const match = DESCRIPTION_ASSET_RE.exec(asset);
    if (!match) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const ext = match[1];
    if (!ext) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const contentType = DESCRIPTION_CONTENT_TYPES[ext];
    if (!contentType) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const url = `${STEAM_STORE_ASSETS_BASE}/${id}/extras/${asset}`;
    try {
      const result = await streamUpstream(url, range);
      res.status(result.status);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Accept-Ranges", result.acceptRanges ?? "bytes");
      if (result.contentLength) res.setHeader("Content-Length", result.contentLength);
      if (result.contentRange) res.setHeader("Content-Range", result.contentRange);
      result.body.pipe(res);
    } catch (err) {
      if (err instanceof UpstreamError) {
        res.status(HttpStatus.BAD_GATEWAY).send();
        return;
      }
      throw err;
    }
  }

  // Streaming proxy for storefront microtrailer clips. The stored filename
  // shape `{appid}/{movieid}/{hash}/microtrailer.{webm|mp4}` is split into
  // explicit segments so the route's path-traversal surface is bounded —
  // each segment is alphanumeric (+`_`/`-`) only, no `..`, no slashes. The
  // ext segment is keyed against the codec map so an off-list extension
  // 400s before reaching the upstream.
  @Get("steam/microtrailer/:appid/:movieid/:hash/microtrailer.:ext")
  @Header("Cache-Control", MICROTRAILER_CACHE)
  async steamMicrotrailer(
    @Param("appid") appid: string,
    @Param("movieid") movieid: string,
    @Param("hash") hash: string,
    @Param("ext") ext: string,
    @Headers("range") range: string | undefined,
    @Res() res: Response
  ): Promise<void> {
    const id = Number.parseInt(appid, 10);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    if (!MICROTRAILER_SEGMENT_RE.test(movieid) || !MICROTRAILER_SEGMENT_RE.test(hash)) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const contentType = MICROTRAILER_CONTENT_TYPES[ext];
    if (!contentType) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const url = `${STEAM_STORE_ASSETS_BASE}/${id}/${movieid}/${hash}/microtrailer.${ext}`;
    try {
      const result = await streamUpstream(url, range);
      res.status(result.status);
      res.setHeader("Content-Type", contentType);
      res.setHeader("Accept-Ranges", result.acceptRanges ?? "bytes");
      if (result.contentLength) res.setHeader("Content-Length", result.contentLength);
      if (result.contentRange) res.setHeader("Content-Range", result.contentRange);
      result.body.pipe(res);
    } catch (err) {
      if (err instanceof UpstreamError) {
        res.status(HttpStatus.BAD_GATEWAY).send();
        return;
      }
      throw err;
    }
  }

  // Poster frame for the microtrailer — Steam returns it as
  // `{appid}/extras/{name}.{jpg|jpeg|png}`. Bucket is locked to `extras`
  // (the only bucket observed for `screenshot_medium`); name is constrained
  // to filename-safe characters so traversal can't escape the route.
  @Get("steam/microtrailer-poster/:appid/extras/:asset")
  @Header("Cache-Control", MICROTRAILER_CACHE)
  async steamMicrotrailerPoster(
    @Param("appid") appid: string,
    @Param("asset") asset: string,
    @Res() res: Response
  ): Promise<void> {
    const id = Number.parseInt(appid, 10);
    if (!Number.isFinite(id) || id <= 0) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const match = MICROTRAILER_POSTER_NAME_RE.exec(asset);
    if (!match) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const ext = match[1];
    if (!ext) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const contentType = MICROTRAILER_POSTER_CONTENT_TYPES[ext];
    if (!contentType) {
      res.status(HttpStatus.BAD_REQUEST).send();
      return;
    }
    const url = `${STEAM_STORE_ASSETS_BASE}/${id}/extras/${asset}`;
    try {
      const result = await streamUpstream(url);
      res.status(result.status);
      res.setHeader("Content-Type", contentType);
      if (result.contentLength) res.setHeader("Content-Length", result.contentLength);
      result.body.pipe(res);
    } catch (err) {
      if (err instanceof UpstreamError) {
        res.status(HttpStatus.BAD_GATEWAY).send();
        return;
      }
      throw err;
    }
  }

  private async proxyWebp(
    urls: string[],
    params: TranscodeParams,
    res: Response
  ): Promise<void> {
    try {
      const bytes = await fetchUpstreamChain(urls);
      const webp = await transcodeToWebp(bytes, params);
      res.send(webp);
    } catch (err) {
      if (err instanceof UpstreamError) {
        res.status(HttpStatus.BAD_GATEWAY).send();
        return;
      }
      throw err;
    }
  }
}
