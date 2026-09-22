// Content barrel. Engine, render and UI import content ONLY from here.
import type { ContentBundle } from './types'
import { STAGES } from './stages'
import { CONCEPTS } from './concepts'
import { DECISIONS } from './decisions'
import { FURNITURE } from './furniture'
import { OFFICE_LINES } from './officeLines'
import { EMPLOYEE_NAMES } from './names'
import { ACTIVITY_TEXT, DEPT_TEXT, NPC_TEXT, POST_MORTEM_TEXT, PROJECT_CATEGORY_TEXT, UI_TEXT } from './text'

export * from './types'
export { STAGES, CONCEPTS, DECISIONS, FURNITURE, OFFICE_LINES, EMPLOYEE_NAMES }
export { ACTIVITY_TEXT, DEPT_TEXT, NPC_TEXT, POST_MORTEM_TEXT, PROJECT_CATEGORY_TEXT, UI_TEXT }

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
}
