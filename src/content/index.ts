// Content barrel. Engine, render and UI import content ONLY from here.
import type { ContentBundle, DecisionCard } from './types'
import { STAGES } from './stages'
import { CONCEPTS } from './concepts'
import { DECISIONS as CARD_DECISIONS } from './decisions'
import { CRISES, CRISIS_CARDS } from './crises'
import { SECRET_CARDS, THREAD_CARDS } from './threads'
import { TEASERS } from './teasers'
import { FURNITURE } from './furniture'
import { OFFICE_LINES } from './officeLines'
import { EMPLOYEE_NAMES, ENTERPRISE_NAMES, NPC_NAMES, PROJECT_NAMES } from './names'
import { ACTIVITY_TEXT, DEPT_TEXT, NPC_TEXT, POST_MORTEM_TEXT, PROJECT_CATEGORY_TEXT } from './text'
import { UI_TEXT as BASE_UI_TEXT } from './strings'
import { TIME_TEXT } from './timeText'
import { LOOP_TEXT } from './loopText'
import { TOP_BAR_TEXT } from './topBarText'
import { BOTTOM_BAR_TEXT } from './bottomBarText'
import { METRICS_TEXT } from './metricsText'
import { ONLINE_TEXT } from './onlineText'
import { HUD_TEXT } from './hudText'
import { GOALS, goalsOfStage } from './goals'
import { POLICIES, REMOTE_FIRST_FLAG } from './policies'
import { MARKET_SEGMENTS, segmentDef, type MarketSegmentDef } from './markets'

/**
 * Every decision card: the rolled ones, the thread steps and secret cards (GAMEPLAY V2 §9.2) + the crisis cards the
 * calendar brings (§5.1). At most 65 in all (§3 md.11).
 */
const DECISIONS: readonly DecisionCard[] = [...CARD_DECISIONS, ...THREAD_CARDS, ...SECRET_CARDS, ...CRISIS_CARDS]

/** strings.ts + feature tables (time flow, core loop, V2 HUD). One flat key → text dictionary. */
const UI_TEXT: Record<string, string> = { ...BASE_UI_TEXT, ...TIME_TEXT, ...LOOP_TEXT, ...TOP_BAR_TEXT, ...BOTTOM_BAR_TEXT, ...METRICS_TEXT, ...ONLINE_TEXT, ...HUD_TEXT }

export * from './types'
export { STAGES, CONCEPTS, DECISIONS, FURNITURE, OFFICE_LINES, EMPLOYEE_NAMES }
export { ACTIVITY_TEXT, DEPT_TEXT, NPC_TEXT, POST_MORTEM_TEXT, PROJECT_CATEGORY_TEXT, UI_TEXT }
// Additions (content lane): extra name pools, typed text tables, formatting helpers.
export { NPC_NAMES, PROJECT_NAMES, ENTERPRISE_NAMES }
export { GOALS, goalsOfStage }
export { CRISES, CRISIS_CARDS }
export { THREAD_CARDS, SECRET_CARDS, TEASERS }
export { POLICIES, REMOTE_FIRST_FLAG }
export { MARKET_SEGMENTS, segmentDef, type MarketSegmentDef }
export {
  ACTION_ERROR_TEXT,
  ARCHETYPE_TEXT,
  CONCEPT_TITLE,
  DECISION_CATEGORY_TEXT,
  EMPLOYEE_STATUS_TEXT,
  FOUNDER_ACTION_TEXT,
  HUD_WIDGET_TEXT,
  MILESTONE_TEXT,
  POST_MORTEM_TITLE,
  SLOT_TYPE_TEXT,
  TOOL_TEXT,
} from './strings'
export * from './format'
export { suggestCompanyName, checkCompanyName, COMPANY_NAME_ISSUE_TEXT, type CompanyNameCheck, type CompanyNameIssue } from './companyName'
export { ROADMAP_STEPS, type RoadmapStep } from './roadmap'

export const CONTENT: ContentBundle = {
  stages: STAGES,
  concepts: CONCEPTS,
  decisions: DECISIONS,
  furniture: FURNITURE,
  officeLines: OFFICE_LINES,
  employeeNames: EMPLOYEE_NAMES,
  activityText: ACTIVITY_TEXT,
  postMortemText: POST_MORTEM_TEXT,
  deptText: DEPT_TEXT,
  projectCategoryText: PROJECT_CATEGORY_TEXT,
  npcText: NPC_TEXT,
  uiText: UI_TEXT,
  goals: GOALS,
  crises: CRISES,
  policies: POLICIES,
}
