import type { WorkReportFormValues } from './types'
import { getLocalDateInputValue } from './workReportForm'

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem' | 'removeItem'>

export const WORK_REPORT_DRAFT_STORAGE_KEY = 'phoenix.work-report.draft.v1'

export function createDefaultWorkReportDraft(
  workDate = getLocalDateInputValue(),
): WorkReportFormValues {
  return {
    workDate,
    departmentId: '',
    equipmentId: '',
    phenomenon: '',
    cause: '',
    workContent: '',
    progress: '',
  }
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') return null
  try {
    return window.localStorage
  } catch {
    return null
  }
}

function getSafeString(value: unknown, maxLength: number): string {
  return typeof value === 'string' && value.length <= maxLength ? value : ''
}

function isValidDateInput(value: unknown): value is string {
  if (value === '') return true
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) return false
  const [, yearValue, monthValue, dayValue] = match
  const year = Number(yearValue)
  const month = Number(monthValue)
  const day = Number(dayValue)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function getSafeProgress(value: unknown): string {
  return value === '' ||
    value === 'completed' ||
    value === 'continued' ||
    value === 'follow_up'
    ? value
    : ''
}

export function isWorkReportDraftEmpty(
  draft: WorkReportFormValues,
  defaultWorkDate = getLocalDateInputValue(),
): boolean {
  const defaultDraft = createDefaultWorkReportDraft(defaultWorkDate)
  return (Object.keys(defaultDraft) as (keyof WorkReportFormValues)[]).every(
    (key) => draft[key] === defaultDraft[key],
  )
}

export function loadWorkReportDraft(
  storage: ReadableStorage | null = getBrowserStorage(),
  defaultWorkDate = getLocalDateInputValue(),
): WorkReportFormValues {
  const defaultDraft = createDefaultWorkReportDraft(defaultWorkDate)
  if (!storage) return defaultDraft
  try {
    const storedValue = storage.getItem(WORK_REPORT_DRAFT_STORAGE_KEY)
    if (!storedValue) return defaultDraft
    const parsed: unknown = JSON.parse(storedValue)
    if (typeof parsed !== 'object' || parsed === null) return defaultDraft
    const draft = parsed as Record<string, unknown>
    return {
      workDate: isValidDateInput(draft.workDate)
        ? draft.workDate
        : defaultWorkDate,
      departmentId: getSafeString(draft.departmentId, 36),
      equipmentId: getSafeString(draft.equipmentId, 36),
      phenomenon: getSafeString(draft.phenomenon, 2000),
      cause: getSafeString(draft.cause, 2000),
      workContent: getSafeString(draft.workContent, 2000),
      progress: getSafeProgress(draft.progress ?? draft.result),
    }
  } catch {
    return defaultDraft
  }
}

export function saveWorkReportDraft(
  draft: WorkReportFormValues,
  storage: WritableStorage | null = getBrowserStorage(),
  defaultWorkDate = getLocalDateInputValue(),
): boolean {
  if (!storage) return false
  try {
    if (isWorkReportDraftEmpty(draft, defaultWorkDate)) {
      storage.removeItem(WORK_REPORT_DRAFT_STORAGE_KEY)
    } else {
      storage.setItem(WORK_REPORT_DRAFT_STORAGE_KEY, JSON.stringify(draft))
    }
    return true
  } catch {
    return false
  }
}

export function clearWorkReportDraft(
  storage: Pick<Storage, 'removeItem'> | null = getBrowserStorage(),
): boolean {
  if (!storage) return false
  try {
    storage.removeItem(WORK_REPORT_DRAFT_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
