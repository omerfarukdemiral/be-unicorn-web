// F5: a lost WebGL context is counted (exit note, lowPower after repeats) and a restore asks for a frame.
import { describe, expect, it, vi } from 'vitest'
import { GL_LOSSES_TO_LOW_POWER, watchContextLoss } from './contextLoss'

describe('watchContextLoss', () => {
  it('counts losses, calls restore, and stops listening when undone', () => {
    const canvas = new EventTarget() as unknown as HTMLCanvasElement
    const onLost = vi.fn()
    const onRestored = vi.fn()
    const undo = watchContextLoss(canvas, { onLost, onRestored })
    canvas.dispatchEvent(new Event('webglcontextlost'))
    canvas.dispatchEvent(new Event('webglcontextrestored'))
    canvas.dispatchEvent(new Event('webglcontextlost'))
    expect(onLost.mock.calls.map((c) => c[0])).toEqual([1, GL_LOSSES_TO_LOW_POWER])
    expect(onRestored).toHaveBeenCalledOnce()
    undo()
    canvas.dispatchEvent(new Event('webglcontextlost'))
    expect(onLost).toHaveBeenCalledTimes(2)
  })
})
