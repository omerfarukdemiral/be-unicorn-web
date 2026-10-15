// Free office grid copy (grid design §4). One short line each; the edit mode's ghost words come with step 3.
import type { ActionErrorCode } from '../engine/types'

/** Refusals of a layout change (moveItem to a cell, applyLayout). */
export const LAYOUT_ERROR_TEXT: Pick<Record<ActionErrorCode, string>, 'blocksDoor' | 'sealsDesk' | 'officeFull'> = {
  blocksDoor: 'Kapının önü kapanır.',
  sealsDesk: 'Bir masaya yol kalmaz.',
  officeFull: 'Ofis dolu.',
}
