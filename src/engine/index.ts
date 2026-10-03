// Engine barrel. `createGame / step / applyAction` are bound to the real content; `createEngine` takes any content (tests, sim).
import { CONTENT } from '../content/index'
import { applyAction as applyActionWith } from './actions'
import { createGame as createGameWith } from './createGame'
import { step as stepWith } from './tick'
import type { Action, ActionResult, EngineApi, GameState, NewGameOptions } from './types'
import type { EngineContent } from './util'

export function createEngine(content: EngineContent): EngineApi {
  return {
    createGame: (opts: NewGameOptions) => createGameWith(opts, content),
    step: (state: GameState, dtDays: number) => stepWith(state, dtDays, content),
    applyAction: (state: GameState, action: Action) => applyActionWith(state, action, content),
  }
}

export const engine: EngineApi = createEngine(CONTENT)
export const createGame = (opts: NewGameOptions): GameState => engine.createGame(opts)
export const step = (state: GameState, dtDays: number): GameState => engine.step(state, dtDays)
export const applyAction = (state: GameState, action: Action): ActionResult => engine.applyAction(state, action)

export type { EngineContent } from './util'
export * from './types'
export * as balance from './balance'
export * as economy from './economy'
export { serialize, deserialize, migrate, type SaveFile } from './save'
export { Rng, createRngState, hashSeed } from './rng'
export { cleanCompanyName } from './createGame'
export { founderActionError, movesError, renewError, renewHoldChance } from './founder'
export { refreshCost } from './people'
export { ringOpenCost, nextLockedRing, findAutoSlot, findAutoSlotFor, canPlaceAt, type PlacementSpec } from './office'
export { nextStep, horizon, nextCrisis, daysToPayday, owedTotal, heldWages, policyCost, previewSpend, cashProjection, companyProfile, targetProfile, covenantState, runwayAt, roundEndRunway, adBudgetSteps, AD_STEP_KEYS, PRICE_STEPS, nearestPriceStep, rivalNotch } from './loopSelectors'
export type { CovenantLight, CovenantState, AdStepKey } from './loopSelectors'
export { autoPaydayChoice, isPaydayChoice, releaseLevel, releaseWave } from './loop'
export { directorOf, playerPower, rivalStrengthTarget, segmentError, acquireError, acquirePrice, rivalOut, acquireUsers, marketUpkeep, boardTarget } from './world'
export { downRoundOpen, roundRetryIn } from './round'
export { loanAmount, loanMonthlyService } from './effects'
export { policyError } from './actions'
export { boardEquity, policyEquity } from './round'
