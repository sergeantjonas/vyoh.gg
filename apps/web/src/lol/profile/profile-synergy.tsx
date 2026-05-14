import { championSquareIconUrl } from "@/lol/_shared/champion-icon";
import { useAccountFromSlug } from "@/lol/_shared/account/use-account-from-slug";
import { useChampionPairs } from "@/lol/profile/use-champion-pairs";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import { Link } from "@tanstack/react-router";
import { Chord, Ribbon } from "@visx/chord";
import { Group } from "@visx/group";
import { ParentSize } from "@visx/responsive";
import type { ChampionPair } from "@vyoh/shared";
import { m } from "motion/react";
import { useMemo } from "react";

const MIN_TOTAL_GAMES = 10;
const MIN_RIBBON_GAMES = 2;
const TOP_PER_SIDE = 6;

const TOOLTIP_CLASS =
  "pointer-events-none z-50 max-w-xs rounded-md border bg-popover/85 px-3 py-2 text-xs text-popover-foreground shadow-xl backdrop-blur-md data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95";

const YOUR_ARC_COLOR = "rgb(52, 211, 153)";
const THEIRS_ARC_COLOR = "rgb(96, 165, 250)";
const WIN_COLOR = "rgb(52, 211, 153)";
const LOSS_COLOR = "rgb(244, 63, 94)";

interface ChordData {
  champions: string[];
  yourCount: number;
  matrix: number[][];
  pairGames: Map<string, number>;
  pairWins: Map<string, number>;
  totalGames: number;
}

function topN<T>(entries: T[], byKey: (x: T) => number, n: number): T[] {
  return [...entries].sort((a, b) => byKey(b) - byKey(a)).slice(0, n);
}

function prepareChord(pairs: ChampionPair[]): ChordData | null {
  if (pairs.length === 0) return null;

  const youTotals = new Map<string, number>();
  const themTotals = new Map<string, number>();
  for (const p of pairs) {
    youTotals.set(p.yourChamp, (youTotals.get(p.yourChamp) ?? 0) + p.games);
    themTotals.set(p.teammateChamp, (themTotals.get(p.teammateChamp) ?? 0) + p.games);
  }

  const yourChamps = topN([...youTotals.entries()], ([, n]) => n, TOP_PER_SIDE).map(
    ([c]) => c
  );
  const teammateChamps = topN([...themTotals.entries()], ([, n]) => n, TOP_PER_SIDE).map(
    ([c]) => c
  );

  // Champions can appear on both sides if you play a champion that teammates
  // also play frequently — disambiguate so the matrix is square and unique.
  // For now we keep them as separate logical nodes by prefixing "you:" /
  // "them:" internally; the display strips the prefix.
  const champions = [
    ...yourChamps.map((c) => `you:${c}`),
    ...teammateChamps.map((c) => `them:${c}`),
  ];
  const yourCount = yourChamps.length;
  const champIdx = new Map(champions.map((c, i) => [c, i]));
  const N = champions.length;
  const matrix = Array.from({ length: N }, () => new Array<number>(N).fill(0));
  const pairGames = new Map<string, number>();
  const pairWins = new Map<string, number>();

  let totalGames = 0;
  for (const p of pairs) {
    if (p.games < MIN_RIBBON_GAMES) continue;
    const i = champIdx.get(`you:${p.yourChamp}`);
    const j = champIdx.get(`them:${p.teammateChamp}`);
    if (i === undefined || j === undefined) continue;
    const rowI = matrix[i];
    const rowJ = matrix[j];
    if (!rowI || !rowJ) continue;
    // Symmetric matrix so d3-chord sizes both endpoints by their total flow;
    // an asymmetric matrix would make teammate-side rows sum to 0 and collapse
    // their arcs to a sliver, stacking all icons at the 12 o'clock seam.
    rowI[j] = p.games;
    rowJ[i] = p.games;
    pairGames.set(`${i},${j}`, p.games);
    pairWins.set(`${i},${j}`, p.wins);
    totalGames += p.games;
  }

  if (totalGames < MIN_TOTAL_GAMES) return null;
  return { champions, yourCount, matrix, pairGames, pairWins, totalGames };
}

function annularSegment(
  innerR: number,
  outerR: number,
  startAngle: number,
  endAngle: number
): string {
  const x1 = Math.sin(startAngle) * outerR;
  const y1 = -Math.cos(startAngle) * outerR;
  const x2 = Math.sin(endAngle) * outerR;
  const y2 = -Math.cos(endAngle) * outerR;
  const x3 = Math.sin(endAngle) * innerR;
  const y3 = -Math.cos(endAngle) * innerR;
  const x4 = Math.sin(startAngle) * innerR;
  const y4 = -Math.cos(startAngle) * innerR;
  const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;
  return `M ${x1} ${y1} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2} ${y2} L ${x3} ${y3} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x4} ${y4} Z`;
}

function displayName(prefixed: string): string {
  return prefixed.replace(/^(you|them):/, "");
}

function ChordChart({ data, accountSlug }: { data: ChordData; accountSlug: string }) {
  return (
    <ParentSize>
      {({ width }) => {
        const size = Math.min(width, 420);
        if (size < 120) return null;
        const outerR = size / 2 - 32;
        const innerR = outerR - 8;
        const iconR = outerR + 16;
        const iconSize = 22;

        return (
          <svg
            width={size}
            height={size}
            role="img"
            aria-label="Champion synergy chord"
            className="mx-auto block"
          >
            <Group left={size / 2} top={size / 2}>
              <Chord
                matrix={data.matrix}
                padAngle={0.08}
                sortGroups={null}
                sortSubgroups={(a, b) => b - a}
              >
                {({ chords }) => (
                  <>
                    {/* Arc rim segments per champion */}
                    {chords.groups.map((group) => {
                      const isYour = group.index < data.yourCount;
                      const champ = displayName(data.champions[group.index] ?? "");
                      return (
                        <TooltipPrimitive.Root
                          key={`arc-${group.index}`}
                          delayDuration={80}
                        >
                          <TooltipPrimitive.Trigger asChild>
                            <path
                              d={annularSegment(
                                innerR,
                                outerR,
                                group.startAngle,
                                group.endAngle
                              )}
                              fill={isYour ? YOUR_ARC_COLOR : THEIRS_ARC_COLOR}
                              fillOpacity={0.55}
                              stroke="var(--background)"
                              strokeWidth={0.5}
                            />
                          </TooltipPrimitive.Trigger>
                          <TooltipPrimitive.Portal>
                            <TooltipPrimitive.Content
                              side="top"
                              sideOffset={6}
                              className={TOOLTIP_CLASS}
                            >
                              <span className="font-semibold">{champ}</span>
                              <span className="text-muted-foreground">
                                {" · "}
                                {isYour ? "you" : "teammate"} · {Math.round(group.value)}{" "}
                                games
                              </span>
                            </TooltipPrimitive.Content>
                          </TooltipPrimitive.Portal>
                        </TooltipPrimitive.Root>
                      );
                    })}

                    {/* Ribbons between pairs */}
                    {chords.map((chord) => {
                      // Matrix is symmetric so chord source/target may come in
                      // either order; pairGames is keyed by you-index < them-index.
                      const lo = Math.min(chord.source.index, chord.target.index);
                      const hi = Math.max(chord.source.index, chord.target.index);
                      const key = `${lo},${hi}`;
                      const games = data.pairGames.get(key) ?? 0;
                      const wins = data.pairWins.get(key) ?? 0;
                      if (games === 0) return null;
                      const wr = wins / games;
                      const color = wr >= 0.5 ? WIN_COLOR : LOSS_COLOR;
                      const opacity =
                        0.25 + Math.min(0.45, (games / data.totalGames) * 5);
                      const youChamp = displayName(data.champions[lo] ?? "");
                      const themChamp = displayName(data.champions[hi] ?? "");
                      return (
                        <TooltipPrimitive.Root
                          key={`ribbon-${chord.source.index}-${chord.target.index}`}
                          delayDuration={80}
                        >
                          <TooltipPrimitive.Trigger asChild>
                            <Ribbon
                              chord={chord}
                              radius={innerR}
                              fill={color}
                              fillOpacity={opacity}
                              stroke={color}
                              strokeOpacity={Math.min(0.6, opacity + 0.2)}
                              strokeWidth={0.5}
                            />
                          </TooltipPrimitive.Trigger>
                          <TooltipPrimitive.Portal>
                            <TooltipPrimitive.Content
                              side="top"
                              sideOffset={6}
                              className={TOOLTIP_CLASS}
                            >
                              <span className="font-semibold">{youChamp}</span>
                              <span className="text-muted-foreground"> + </span>
                              <span className="font-semibold">{themChamp}</span>
                              <div className="mt-0.5 text-muted-foreground">
                                {games} {games === 1 ? "game" : "games"} ·{" "}
                                {Math.round(wr * 100)}% WR
                              </div>
                            </TooltipPrimitive.Content>
                          </TooltipPrimitive.Portal>
                        </TooltipPrimitive.Root>
                      );
                    })}

                    {/* Champion icons just outside the rim */}
                    {chords.groups.map((group) => {
                      const mid = (group.startAngle + group.endAngle) / 2;
                      const x = Math.sin(mid) * iconR;
                      const y = -Math.cos(mid) * iconR;
                      const champ = displayName(data.champions[group.index] ?? "");
                      return (
                        <Link
                          key={`icon-${group.index}`}
                          to="/lol/$accountSlug/champions/$championKey"
                          params={{ accountSlug, championKey: champ.toLowerCase() }}
                          style={{ cursor: "pointer" }}
                        >
                          <image
                            href={championSquareIconUrl(champ, 48)}
                            x={x - iconSize / 2}
                            y={y - iconSize / 2}
                            width={iconSize}
                            height={iconSize}
                            preserveAspectRatio="xMidYMid slice"
                          />
                        </Link>
                      );
                    })}
                  </>
                )}
              </Chord>
            </Group>
          </svg>
        );
      }}
    </ParentSize>
  );
}

export function ProfileSynergy({ accountSlug }: { accountSlug: string }) {
  const account = useAccountFromSlug(accountSlug);
  const { data, isPending } = useChampionPairs(account);

  const chordData = useMemo(() => (data ? prepareChord(data) : null), [data]);

  if (isPending || !data) return null;
  if (!chordData) {
    return (
      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-medium text-muted-foreground">Synergy</h3>
        <p className="rounded-lg border border-dashed bg-card/20 px-3 py-3 text-xs text-muted-foreground/70">
          Not enough team data to map champion synergy yet.
        </p>
      </section>
    );
  }

  return (
    <m.section
      className="flex flex-col gap-2"
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
    >
      <div className="flex items-baseline justify-between">
        <h3 className="text-sm font-medium text-muted-foreground">Synergy</h3>
        <span className="text-[10px] text-muted-foreground/60">
          <span className="text-emerald-400/80">●</span> your champs ·{" "}
          <span className="text-blue-400/80">●</span> teammates' picks · ribbon color =
          win rate
        </span>
      </div>
      <div className="rounded-lg border bg-card/40 p-2">
        <ChordChart data={chordData} accountSlug={accountSlug} />
      </div>
    </m.section>
  );
}
