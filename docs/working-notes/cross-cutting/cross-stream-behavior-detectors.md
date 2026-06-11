# Cross-stream behavior detectors

**Status:** Reference — idea on file (2026-06-12 exploration, indexed in [idea-pool-2026-06.md](idea-pool-2026-06.md)), not scoped. **Hard gate: SteamPlaySession accumulation.** The forward-only session model ([../steam/steam-integration.md](../steam/steam-integration.md)) only has data since ~2026-05; detectors need months of overlap with LoL history before verdicts are honest. Re-evaluate around 2026-09.

## Why

Detectors that need *both* streams are the purest expression of the N=1 thesis — op.gg can never say "after three losses you go play Deep Rock Galactic," and Steam can never see the losses. They're also exactly the [self-portrait-surfaces.md](self-portrait-surfaces.md) "behavioral self-awareness" direction made concrete. Belongs on `/` (cross-stream synthesis only, per [repo-conventions.md](../../repo-conventions.md#per-stream-routes--is-synthesis-only)), speaking in `ConclusionCard` verdicts.

## Detector candidates

1. **Tilt escape-hatch** (flagship). After an N-loss LoL streak, how often does a Steam session start within X minutes, and in which game? Verdict shape: *"After 3+ losses you reliably switch to {game} within 40 minutes."* Data: LoL match end-times + results (have, deep history) × Steam session starts (forward-only). Self-aware-humor tone fits the recap voice.
2. **Post-win stop** ("go out on a high"). Probability the evening's last LoL game is a win vs a loss — do you quit on wins or queue until you lose? Single-stream data (have it today) but the verdict gets stronger with the Steam continuation signal ("…or you switch to {game}").
3. **Comfort-game taxonomy.** Classify Steam games by *when* they get played: post-loss games, free-weekend games, late-night games. Output feeds detector 1 and makes a characterful library annotation ("your comfort game").
4. **Weekday/weekend stream mix.** Ranked share weekdays vs weekends; pairs with the shipped chronotype panel rather than competing with it.

## Shape

- Detectors run server-side as derivations over existing tables (no new upstream calls); each emits a verdict + sample size, rendered as `ConclusionCard`s. The recap detector engine ([self-portrait-recap-arc.md](self-portrait-recap-arc.md)) is the architectural reference — and note its R-7i lane A/B detectors are parked **for the same data-sufficiency reason**; whatever minimum-sample convention unblocks those should be defined once and shared.
- **Define minimum-sample thresholds before building** (e.g. detector 1 needs ≥10 qualifying loss-streaks with Steam-session overlap). A detector that fires on n=3 is a horoscope; below threshold the tile must show its "still collecting" state honestly rather than a shaky verdict.
- Session reconstruction caveat: Steam exposes no true session log (confirmed dead end in [../steam/steam-integration.md](../steam/steam-integration.md)); "session start" means first poll observing the game running — minutes-level precision, fine for ≥40-minute windows, not for tighter claims.

## Risks / open questions

- Post-win stop (detector 2) could ship early as LoL-only with the cross-stream upgrade later — cheapest probe of whether the detector voice lands.
- These verdicts are about the owner's habits, published publicly — owner comfort check per detector before shipping is part of scoping, same filter the self-portrait brainstorm applied.
