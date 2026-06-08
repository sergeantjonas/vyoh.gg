// Shared rect-FLIP fallback for the section identity morph (Profile↔tab
// avatar + name morph). Both `lol/profile/identity-morph-nav.ts` and
// `steam/profile/identity-morph-nav.ts` use this when the engine doesn't
// support View Transitions (Firefox) so the avatar still travels between
// the cinematic hero and the persistent strip on tab navigation.
//
// Same mechanism as match-hero / library-row / game-panel-hero's row→panel
// FLIP: hide the destination until the next RAF (no flash at the natural
// position), measure dest rect, animate from `sourceRect → 0` via a single
// transform keyframe. 350 ms feels right for an identity-sized element —
// shorter than the 550 ms used for big card morphs because the avatar and
// name span much smaller distances and would over-linger otherwise.

const FLIP_DURATION_MS = 350;
const FLIP_EASING = "cubic-bezier(0.22, 1, 0.36, 1)";

/**
 * FLIP-animate `el` from `sourceRect` to its natural post-layout rect.
 * Visibility-hides the element until the next RAF so the destination
 * doesn't flash at its final position before the animation starts (same
 * pattern as match-hero — keep both behaviours in sync if you tweak one).
 */
export function rectFlipFromSource(el: HTMLElement, sourceRect: DOMRect): void {
  el.style.visibility = "hidden";
  requestAnimationFrame(() => {
    el.style.visibility = "";
    const dr = el.getBoundingClientRect();
    const dx = sourceRect.left - dr.left;
    const dy = sourceRect.top - dr.top;
    const sx = sourceRect.width / dr.width;
    const sy = sourceRect.height / dr.height;
    el.animate(
      [
        {
          transform: `translate(${dx}px, ${dy}px) scaleX(${sx}) scaleY(${sy})`,
          transformOrigin: "0 0",
        },
        { transform: "none", transformOrigin: "0 0" },
      ],
      { duration: FLIP_DURATION_MS, easing: FLIP_EASING, fill: "none" }
    );
  });
}

interface IdentityElements {
  avatar: HTMLElement | null;
  name: HTMLElement | null;
}

export interface RunIdentityRectMorphOptions {
  sourceAvatarRect: DOMRect | null;
  sourceNameRect: DOMRect | null;
  navigate: () => Promise<unknown>;
  readDest: () => IdentityElements;
}

/**
 * Drive the rect-FLIP morph: fire the navigation, then on resolution
 * FLIP-animate the destination avatar and name from their pre-nav source
 * rects to their natural positions. Returns synchronously; the navigation
 * + animation run in the background.
 *
 * The caller is responsible for the guard logic (source identity exists,
 * hero on one end, slide-shaped nav). This helper only owns the post-nav
 * mechanics so the LoL and Steam drivers share one battle-tested impl.
 */
export function runIdentityRectMorph(opts: RunIdentityRectMorphOptions): void {
  void opts.navigate().then(() => {
    const dest = opts.readDest();
    if (opts.sourceAvatarRect && dest.avatar) {
      rectFlipFromSource(dest.avatar, opts.sourceAvatarRect);
    }
    if (opts.sourceNameRect && dest.name) {
      rectFlipFromSource(dest.name, opts.sourceNameRect);
    }
  });
}
