# Cross-section navigation arc

**Status:** CLOSED 2026-05-31 — evaluated existing behavior, baseline judged sufficient, no code needed. Original premise (the cross-section moment reads as an undesigned chrome swap) didn't hold up against what router-level VT already does today. Recorded here so future readers don't re-litigate.

---

## Why this closed without code

The original 2026-05-27 brainstorm assumed that [section-shell-vt-migration](section-shell-vt-migration.md) only handled the body slide and left the chrome untouched. That assumption was wrong on inspection:

- Router-level VT classifier in [`navigation-type.ts:84-85`](../../apps/web/src/lib/navigation-type.ts#L84-L85) already emits `type=cross-section` for every LoL ↔ Steam ↔ `/` ↔ `/status` nav.
- The corresponding CSS in [`view-transitions.css:139-154`](../../apps/web/src/styles/view-transitions.css#L139-L154) fades **both** `vt-main` AND `root` groups over 200ms ease-out on that type. (Slide types hold root; cross-section explicitly fades it.)
- The section strip lives in `#section-header-slot` (a flex sibling above `<main>` in [`__root.tsx:101`](../../apps/web/src/routes/__root.tsx#L101)) and has no `view-transition-name` — so it falls into the implicit `root` group and crossfades alongside the body today.
- The [accent cascade](accent-color-system.md) retints nav active-tab indicators (pulse halo + glint sweep), top-nav wordmark + orb + halo, section progress hairline, and fetch progress bar per-route, so the section identity *also* changes color during the transition.

Net effect on a cross-section click: 200ms full-viewport crossfade plus a per-route color shift. On owner review (2026-05-31), that already reads as a deliberate transition, not a chrome swap. The "chrome swap" framing was speculation against a strawman that didn't match the shipped code.

## What 1.1 also resolved by default

The [nav-condensation-arc](nav-condensation-arc.md) ship (2026-05-31) retired three of this arc's original open decisions before they got to a prototype:

1. **Seam-straddle avatar morph** — moot. Seam was dropped during 1.1; shipped `LolIdentity` is plain inline.
2. **Identity caret handoff** — moot. Caret was dropped; section identity is static.
3. **Sectionless strip variant** — never built. Sectionless routes (`/`, `/status`) ship with no strip, so "how does the strip transition into a sectionless route" reduces to "the strip is part of the `root` group's crossfade, so it fades out with everything else" — handled by the existing CSS, no special-case needed.

And one structural decision baked in:

4. **Identity `layoutId` literals are deliberately per-section namespaced** (`lol-identity-*` in [`identity-layout.ts`](../../apps/web/src/lol/profile/identity-layout.ts), `steam-identity-*` in [`identity-layout.ts`](../../apps/web/src/steam/profile/identity-layout.ts)) so identity **can't** morph across sections by design. Per the [Avatars are identity](~/.claude/projects/-workspaces-vyoh-gg/memory/feedback_avatars_are_identity.md) feedback, summoner icon and Steam pic represent *different platform identities* — morphing one into the other would lie about that. If anyone proposes "morph the avatar across sections" later, cite the namespace decision.

## If this ever reopens

Trigger conditions where someone might revisit:

- Owner notices that the cross-section moment specifically reads as undesigned after living with it for a while (subjective; nothing in the code changed, but feel can shift as surrounding chrome evolves).
- A new top-level section (e.g. `/tft`, `/music`, `/code`) lands and the cross-section transition feels increasingly load-bearing once there are 4+ sections to traverse.
- The accent cascade picks up a stronger per-route signature (e.g. distinctive backgrounds per section) that makes the current uniform 200ms fade feel mismatched against the louder destination identity.

If reopened, the contingent options would be (cheapest first):

- **Tune the existing CSS.** Adjust duration, easing, or opacity curve on the `cross-section` rules in [view-transitions.css](../../apps/web/src/styles/view-transitions.css). No JS, no new scope.
- **Stagger strip vs body.** Give the strip its own `view-transition-name` (conditionally applied like `vt-main` is today) so the cross-section CSS can choreograph it separately — strip leads by 80ms, slides up while body crossfades, holds opacity while contents fade, etc. One named group; still router-VT, no hand-rolled JS.
- **Accent-cascade handshake.** Briefly hold the source accent ~80ms into the transition so the strip fades out in source-color before the dest color fades in. Polish call.
- **Hand-rolled imperative VT (M2b idiom).** Only if router-level CSS can't express what's wanted. Probably never needed — there's no element to morph across sections (per the namespace decision above).

WebKit constraint to inherit: cross-section VT isn't engine-gated today (the WebKit bail in [navigation-type.ts:122](../../apps/web/src/lib/navigation-type.ts#L122) only catches `isSteamLibraryPair`). Any new scope added to the cross-section transition should re-validate Safari snapshot cost per [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md) — easy to regress.

---

## Cross-references

- [elevation-arcs.md](elevation-arcs.md) — flip this arc to ✅ closed-no-code 2026-05-31.
- [nav-condensation-arc.md](nav-condensation-arc.md) — shipped prerequisite; resolved several of this arc's premises by default.
- [section-shell-vt-migration.md](section-shell-vt-migration.md) — the existing body transition that turned out to already cover the chrome via the `root` group fade.
- [view-transitions.css](../../apps/web/src/styles/view-transitions.css) and [navigation-type.ts](../../apps/web/src/lib/navigation-type.ts) — where the existing `cross-section` type and its 200ms crossfade live.
- [accent-color-system.md](accent-color-system.md) — the per-route retint that composes with the crossfade.
- [safari-vt-snapshot-cost.md](safari-vt-snapshot-cost.md) — engine-gate precedent for any future reopen.
