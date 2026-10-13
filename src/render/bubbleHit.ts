// R3F listens on the canvas' parent, and world bubbles (drei <Html>) live inside it: a tap on a bubble reaches the
// scene's raycast too and would hit whatever stands under it (the founder, a slot). Scene handlers ask here first.
export const fromBubble = (ev: { target?: EventTarget | null } | undefined): boolean => {
  const t = ev?.target
  return typeof Element !== 'undefined' && t instanceof Element && t.closest('[data-bubble-key]') !== null
}
