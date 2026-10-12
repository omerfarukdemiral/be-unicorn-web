// Company-name rules shared by the start screen and the server (api/_lib/auth.ts). The rule itself lives in
// engine/names.ts (no imports, so the Vercel functions can load it); this file keeps the old import path alive.
export { COMPANY_NAME_MIN, COMPANY_NAME_MAX, checkCompanyName, type CompanyNameIssue, type CompanyNameCheck } from '../engine/names.js'
