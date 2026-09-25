// Content barrel. Engine, render and UI import content ONLY from here.
import type { ContentBundle } from './types'
import { STAGES } from './stages'
import { CONCEPTS } from './concepts'
import { DECISIONS } from './decisions'
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
import { GOALS, goalsOfStage } from './goals'

/** strings.ts + feature tables (time flow, core loop). One flat key → text dictionary. */
const UI_TEXT: Record<string, string> = { ...BASE_UI_TEXT, ...TIME_TEXT, ...LOOP_TEXT, ...TOP_BAR_TEXT, ...BOTTOM_BAR_TEXT, ...METRICS_TEXT, ...ONLINE_TEXT }

export * from './types'
export { STAGES, CONCEPTS, DECISIONS, FURNITURE, OFFICE_LINES, EMPLOYEE_NAMES }
export { ACTIVITY_TEXT, DEPT_TEXT, NPC_TEXT, POST_MORTEM_TEXT, PROJECT_CATEGORY_TEXT, UI_TEXT }
// Additions (content lane): extra name pools, typed text tables, formatting helpers.
export { NPC_NAMES, PROJECT_NAMES, ENTERPRISE_NAMES }
export { GOALS, goalsOfStage }
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
}
