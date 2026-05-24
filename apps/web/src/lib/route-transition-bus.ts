// Tiny pub/sub for "a router-level view transition is starting". Fired
// from the `defaultViewTransition.types` callback in main.tsx the moment
// before TanStack Router invokes `document.startViewTransition` — early
// enough that subscribers can pause expensive continuous work (video
// decode, RAF loops, ResizeObservers feeding filters) before the OLD
// snapshot is captured. There is intentionally no "transition end" event;
// subscribers schedule their own resume via setTimeout, scoped to the
// known max duration of any of our route VTs (~240ms slide / 200ms fade).

type Listener = () => void;

const listeners = new Set<Listener>();

export function emitRouteTransitionStart(): void {
  for (const listener of listeners) listener();
}

export function onRouteTransitionStart(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
