// WebGL context loss watch for the main canvas (F5), kept apart from GameCanvas so it tests without a DOM.

/** Context losses before the canvas drops to lowPower (smaller GPU footprint: no shadow pass, dpr up to 1.5, no MSAA). */
export const GL_LOSSES_TO_LOW_POWER = 2

/**
 * F5: mobile Safari drops the WebGL context under memory pressure (late-game office at full budget). three already
 * calls preventDefault and rebuilds on restore; here a loss writes the save (the page itself may be killed next),
 * counts into the exit note, and a repeated loss falls back to lowPower. Restore asks for a fresh frame.
 */
export function watchContextLoss(canvas: HTMLCanvasElement, opts: { onLost: (count: number) => void; onRestored: () => void }): () => void {
  let lost = 0
  const onLost = () => {
    lost++
    opts.onLost(lost)
  }
  canvas.addEventListener('webglcontextlost', onLost)
  canvas.addEventListener('webglcontextrestored', opts.onRestored)
  return () => {
    canvas.removeEventListener('webglcontextlost', onLost)
    canvas.removeEventListener('webglcontextrestored', opts.onRestored)
  }
}
