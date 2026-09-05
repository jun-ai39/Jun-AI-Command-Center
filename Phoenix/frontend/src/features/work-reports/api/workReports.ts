import { authenticatedFetch } from '../../auth/api/authenticatedFetch'
import type {
  LegacyWorkReportCategory,
  WorkReport,
  WorkReportAttentionSummary,
  WorkReportConfirmation,
  WorkReportListResponse,
  WorkReportProgress,
} from '../types'

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type WorkReportRequestOptions = {
  readonly baseUrl?: string
  readonly signal?: AbortSignal
}

type WorkReportListRequestOptions = WorkReportRequestOptions & {
  readonly limit?: number
  readonly offset?: number
  readonly workDate?: string
  readonly departmentId?: string
  readonly workContentQuery?: string
  readonly progress?: WorkReportProgress
  readonly equipmentId?: string
}

export class WorkReportApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'WorkReportApiError'
  }
}

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  return configuredUrl || DEFAULT_API_BASE_URL
}

function removeTrailingSlash(url: string): string {
  return url.replace(/\/$/, '')
}

function isLegacyCategory(value: unknown): value is LegacyWorkReportCategory {
  return (
    value === 'inspection' ||
    value === 'maintenance' ||
    value === 'trouble' ||
    value === 'improvement' ||
    value === 'other'
  )
}

function isWorkReportProgress(value: unknown): value is WorkReportProgress {
  return value === 'completed' || value === 'continued' || value === 'follow_up'
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value)
}

function hasValidEquipmentLink(record: Record<string, unknown>): boolean {
  const isUnassigned =
    record.department_id === null &&
    record.equipment_id === null &&
    record.department_name === null &&
    record.equipment_name === null &&
    record.equipment_number === null
  const isAssigned =
    isUuid(record.department_id) &&
    isUuid(record.equipment_id) &&
    typeof record.department_name === 'string' &&
    record.department_name.trim().length >= 1 &&
    typeof record.equipment_name === 'string' &&
    record.equipment_name.trim().length >= 1 &&
    isNullableString(record.equipment_number)
  return isUnassigned || isAssigned
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
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

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isValidOptionalText(value: unknown): value is string | null {
  if (!isNullableString(value)) return false
  if (value === null) return true
  const length = value.trim().length
  return length >= 1 && length <= 2000
}

function isValidLegacyHours(value: unknown): value is number | null {
  if (value === null) return true
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    value >= 0.25 &&
    value <= 24 &&
    Math.abs(value * 4 - Math.round(value * 4)) < Number.EPSILON * 10
  )
}

function isWorkReport(value: unknown): value is WorkReport {
  if (typeof value !== 'object' || value === null) return false

  const record = value as Record<string, unknown>
  const hasValidPhenomenon = isValidOptionalText(record.phenomenon)
  return (
    isUuid(record.id) &&
    isIsoDate(record.work_date) &&
    hasValidEquipmentLink(record) &&
    hasValidPhenomenon &&
    isValidOptionalText(record.cause) &&
    typeof record.work_content === 'string' &&
    record.work_content.trim().length >= 1 &&
    record.work_content.trim().length <= 2000 &&
    isWorkReportProgress(record.progress) &&
    typeof record.is_legacy === 'boolean' &&
    record.is_legacy === (record.phenomenon === null) &&
    (record.legacy_category === null ||
      isLegacyCategory(record.legacy_category)) &&
    isValidLegacyHours(record.legacy_work_hours) &&
    isValidOptionalText(record.legacy_notes) &&
    isIsoTimestamp(record.created_at) &&
    isIsoTimestamp(record.updated_at)
  )
}

function isWorkReportListResponse(
  value: unknown,
): value is WorkReportListResponse {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    Array.isArray(record.items) &&
    record.items.every(isWorkReport) &&
    Number.isInteger(record.total) &&
    Number(record.total) >= 0 &&
    Number.isInteger(record.limit) &&
    Number(record.limit) >= 1 &&
    Number(record.limit) <= 50 &&
    Number.isInteger(record.offset) &&
    Number(record.offset) >= 0 &&
    record.items.length <= Number(record.limit) &&
    record.items.length <= Number(record.total)
  )
}

function isWorkReportAttentionSummary(
  value: unknown,
): value is WorkReportAttentionSummary {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    Number.isInteger(record.continued_count) &&
    Number(record.continued_count) >= 0 &&
    Number.isInteger(record.follow_up_count) &&
    Number(record.follow_up_count) >= 0 &&
    Number.isInteger(record.attention_count) &&
    Number(record.attention_count) ===
      Number(record.continued_count) + Number(record.follow_up_count)
  )
}

function createWorkReportRequestBody(input: WorkReportConfirmation): string {
  const normalizedCause = input.cause.trim()
  return JSON.stringify({
    work_date: input.workDate,
    department_id: input.departmentId,
    equipment_id: input.equipmentId,
    phenomenon: input.phenomenon.trim(),
    cause: normalizedCause || null,
    work_content: input.workContent.trim(),
    progress: input.progress,
  })
}

export async function fetchWorkReports(
  options: WorkReportListRequestOptions = {},
): Promise<WorkReportListResponse> {
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const query = new URLSearchParams({
    limit: String(options.limit ?? 5),
    offset: String(options.offset ?? 0),
  })
  if (options.workDate !== undefined) {
    if (!isIsoDate(options.workDate)) {
      throw new WorkReportApiError('Work report work-date filter is invalid')
    }
    query.set('work_date', options.workDate)
  }
  if (options.departmentId !== undefined) {
    if (!isUuid(options.departmentId)) {
      throw new WorkReportApiError('Work report department filter is invalid')
    }
    query.set('department_id', options.departmentId)
  }
  if (options.workContentQuery !== undefined) {
    const normalizedQuery = options.workContentQuery.trim()
    if (normalizedQuery.length < 1 || normalizedQuery.length > 200) {
      throw new WorkReportApiError('Work report work-content filter is invalid')
    }
    query.set('work_content_query', normalizedQuery)
  }
  if (options.progress !== undefined) {
    if (!isWorkReportProgress(options.progress)) {
      throw new WorkReportApiError('Work report progress filter is invalid')
    }
    query.set('progress', options.progress)
  }
  if (options.equipmentId !== undefined) {
    if (!isUuid(options.equipmentId)) {
      throw new WorkReportApiError('Work report equipment filter is invalid')
    }
    query.set('equipment_id', options.equipmentId)
  }
  const response = await authenticatedFetch(
    `${baseUrl}/work-reports?${query}`,
    {
      headers: { Accept: 'application/json' },
      signal: options.signal,
    },
  )
  if (!response.ok) {
    throw new WorkReportApiError(
      `Work report API returned HTTP ${response.status}`,
    )
  }
  const payload: unknown = await response.json()
  if (!isWorkReportListResponse(payload)) {
    throw new WorkReportApiError(
      'Work report API returned an invalid list response',
    )
  }
  return payload
}

export async function fetchWorkReportAttentionSummary(
  options: WorkReportRequestOptions = {},
): Promise<WorkReportAttentionSummary> {
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const response = await authenticatedFetch(
    `${baseUrl}/work-reports/attention-summary`,
    {
      headers: { Accept: 'application/json' },
      signal: options.signal,
    },
  )
  if (!response.ok) {
    throw new WorkReportApiError(
      `Work report API returned HTTP ${response.status}`,
    )
  }
  const payload: unknown = await response.json()
  if (!isWorkReportAttentionSummary(payload)) {
    throw new WorkReportApiError(
      'Work report API returned an invalid attention summary response',
    )
  }
  return payload
}

async function saveWorkReport(
  method: 'POST' | 'PATCH',
  path: string,
  input: WorkReportConfirmation,
  options: WorkReportRequestOptions,
): Promise<WorkReport> {
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const response = await authenticatedFetch(`${baseUrl}${path}`, {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: createWorkReportRequestBody(input),
    signal: options.signal,
  })
  if (!response.ok) {
    throw new WorkReportApiError(
      `Work report API returned HTTP ${response.status}`,
    )
  }
  const payload: unknown = await response.json()
  if (!isWorkReport(payload)) {
    throw new WorkReportApiError(
      'Work report API returned an invalid item response',
    )
  }
  return payload
}

export function createWorkReport(
  input: WorkReportConfirmation,
  options: WorkReportRequestOptions = {},
): Promise<WorkReport> {
  return saveWorkReport('POST', '/work-reports', input, options)
}

export function updateWorkReport(
  workReportId: string,
  input: WorkReportConfirmation,
  options: WorkReportRequestOptions = {},
): Promise<WorkReport> {
  return saveWorkReport(
    'PATCH',
    `/work-reports/${encodeURIComponent(workReportId)}`,
    input,
    options,
  )
}
