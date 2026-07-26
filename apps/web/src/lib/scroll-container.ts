export const mainScrollRef: { current: HTMLElement | null } = { current: null };

// Height to assume for the scroll viewport when `mainScrollRef` has no element
// to measure — which is every server render, and the client's first render too,
// since callback refs only run at commit. Virtualizers default to a zero-height
// window in that state and emit nothing, so a list route serves an empty
// document; stating a height instead makes them render roughly one screen of
// rows, which is what an HTML-only reader gets.
//
// 900 is a desktop viewport minus browser chrome. It does not need to match any
// real device: it decides how many rows land in the document, and every
// virtualizer remeasures against the true element before the first paint.
export const SSR_VIEWPORT_HEIGHT = 900;
