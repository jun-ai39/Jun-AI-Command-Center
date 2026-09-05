import { authenticatedFetch } from '../../auth/api/authenticatedFetch'
import type { InspectionCycle } from '../../inspection-templates/types'
import type {
  InspectionCycleStatusSummary,
  InspectionScheduleStatusItem,
  InspectionScheduleStatusResponse,
} from '../types'

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/
const CYCLES: readonly InspectionCycle[] = ['daily', 'weekly', 'monthly']

type InspectionStatusRequestOptions = {
  readonly baseUrl?: string
  readonly signal?: AbortSignal
}

export class InspectionStatusApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'InspectionStatusApiError'
    this.status = status
  }
}

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  return configuredUrl || DEFAULT_API_BASE_URL
}

function removeTrailingSlash(url: string): string {
  return url.replace(/\/$/, '')
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = DATE_INPUT_PATTERN.exec(value)
  if (!match) return false
  const candidate = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  )
  return (
    candidate.getUTCFullYear() === Number(match[1]) &&
    candidate.getUTCMonth() === Number(match[2]) - 1 &&
    candidate.getUTCDate() === Number(match[3])
  )
}

function isInspectionCycle(value: unknown): value is InspectionCycle {
  return value === 'daily' || value === 'weekly' || value === 'monthly'
}

function getInspectionPeriodKey(
  targetDate: string,
  cycle: InspectionCycle,
): string {
  if (cycle === 'daily') return targetDate
  if (cycle === 'monthly') return targetDate.slice(0, 7)
  const match = DATE_INPUT_PATTERN.exec(targetDate)
  if (!match) return ''
  const date = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  )
  const day = date.getUTCDay() || 7
  date.setUTCDate(date.getUTCDate() + 4 - day)
  const isoYear = date.getUTCFullYear()
  const yearStart = new Date(Date.UTC(isoYear, 0, 1))
  const isoWeek = Math.ceil(
    ((date.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7,
  )
  return `${isoYear}-W${String(isoWeek).padStart(2, '0')}`
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isCycleSummary(value: unknown): value is InspectionCycleStatusSummary {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    isInspectionCycle(record.cycle) &&
    Number.isInteger(record.total) &&
    Number(record.total) >= 0 &&
    Number.isInteger(record.completed) &&
    Number(record.completed) >= 0 &&
    Number.isInteger(record.pending) &&
    Number(record.pending) >= 0 &&
    Number(record.total) === Number(record.completed) + Number(record.pending)
  )
}

function isStatusItem(
  value: unknown,
  targetDate: string,
): value is InspectionScheduleStatusItem {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (!isInspectionCycle(record.cycle)) return false
  const isPending =
    record.completion_status === 'pending' &&
    record.inspection_record_id === null &&
    record.inspection_date === null &&
    record.overall_judgment === null
  const isCompleted =
    record.completion_status === 'completed' &&
    isUuid(record.inspection_record_id) &&
    isIsoDate(record.inspection_date) &&
    getInspectionPeriodKey(record.inspection_date, record.cycle) ===
      record.period_key &&
    (record.overall_judgment === 'normal' ||
      record.overall_judgment === 'abnormal')
  return (
    isUuid(record.equipment_id) &&
    typeof record.equipment_name === 'string' &&
    record.equipment_name.trim().length >= 1 &&
    isNullableString(record.equipment_number) &&
    isUuid(record.department_id) &&
    typeof record.department_name === 'string' &&
    record.department_name.trim().length >= 1 &&
    record.period_key === getInspectionPeriodKey(targetDate, record.cycle) &&
    Number.isInteger(record.template_item_count) &&
    Number(record.template_item_count) >= 1 &&
    (isPending || isCompleted)
  )
}

function isInspectionStatusResponse(
  value: unknown,
  requestedDate: string,
): value is InspectionScheduleStatusResponse {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (
    record.target_date !== requestedDate ||
    !Array.isArray(record.cycle_summaries) ||
    !Array.isArray(record.items) ||
    !record.cycle_summaries.every(isCycleSummary) ||
    !record.items.every((item) => isStatusItem(item, requestedDate))
  ) {
    return false
  }
  const summaries = record.cycle_summaries as InspectionCycleStatusSummary[]
  const items = record.items as InspectionScheduleStatusItem[]
  if (
    summaries.length !== CYCLES.length ||
    summaries.some((summary, index) => summary.cycle !== CYCLES[index])
  ) {
    return false
  }
  const unitKeys = items.map((item) => `${item.equipment_id}:${item.cycle}`)
  if (new Set(unitKeys).size !== unitKeys.length) return false
  return summaries.every((summary) => {
    const cycleItems = items.filter((item) => item.cycle === summary.cycle)
    const completed = cycleItems.filter(
      (item) => item.completion_status === 'completed',
    ).length
    return (
      summary.total === cycleItems.length &&
      summary.completed === completed &&
      summary.pending === cycleItems.length - completed
    )
  })
}

export async function fetchInspectionStatus(
  targetDate: string,
  options: InspectionStatusRequestOptions = {},
): Promise<InspectionScheduleStatusResponse> {
  if (!isIsoDate(targetDate)) {
    throw new InspectionStatusApiError('Inspection status date is invalid')
  }
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const query = new URLSearchParams({ target_date: targetDate })
  const response = await authenticatedFetch(
    `${baseUrl}/inspection-status?${query}`,
    {
      headers: { Accept: 'application/json' },
      signal: options.signal,
    },
  )
  if (!response.ok) {
    throw new InspectionStatusApiError(
      `Inspection status API returned HTTP ${response.status}`,
      response.status,
    )
  }
  const payload: unknown = await response.json()
  if (!isInspectionStatusResponse(payload, targetDate)) {
    throw new InspectionStatusApiError(
      'Inspection status API returned an invalid response',
    )
  }
  return payload
}
