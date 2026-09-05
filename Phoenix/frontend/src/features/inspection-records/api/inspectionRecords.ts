import { authenticatedFetch } from '../../auth/api/authenticatedFetch'
import type { InspectionCycle } from '../../inspection-templates/types'
import type {
  InspectionJudgment,
  InspectionRecord,
  InspectionRecordCreateInput,
  InspectionRecordItem,
  InspectionRecordListResponse,
  InspectionStatusValue,
} from '../types'

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_ABSOLUTE_VALUE = 999_999_999

type InspectionRecordRequestOptions = {
  readonly baseUrl?: string
  readonly signal?: AbortSignal
}

type InspectionRecordListRequestOptions = InspectionRecordRequestOptions & {
  readonly equipmentId: string
  readonly limit?: number
  readonly offset?: number
}

export class InspectionRecordApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'InspectionRecordApiError'
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

function isInspectionCycle(value: unknown): value is InspectionCycle {
  return value === 'daily' || value === 'weekly' || value === 'monthly'
}

function isJudgment(value: unknown): value is InspectionJudgment {
  return value === 'normal' || value === 'abnormal'
}

function isStatusValue(value: unknown): value is InspectionStatusValue {
  return value === 'normal' || value === 'abnormal'
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isFiniteNumber(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isFinite(value) &&
    Math.abs(value) <= MAX_ABSOLUTE_VALUE
  )
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

function hasValidPeriodKey(
  cycle: InspectionCycle,
  inspectionDate: string,
  value: unknown,
): value is string {
  if (typeof value !== 'string') return false
  if (cycle === 'daily') return value === inspectionDate
  if (cycle === 'weekly')
    return /^\d{4}-W(?:0[1-9]|[1-4]\d|5[0-3])$/.test(value)
  return value === inspectionDate.slice(0, 7)
}

function isNumericInspectionItem(record: Record<string, unknown>): boolean {
  if (
    !isFiniteNumber(record.number_value) ||
    record.status_value !== null ||
    !isFiniteNumber(record.normal_min) ||
    !isFiniteNumber(record.normal_max) ||
    Number(record.normal_min) > Number(record.normal_max) ||
    record.normal_state !== null ||
    !isNullableString(record.unit)
  ) {
    return false
  }
  const expected =
    Number(record.normal_min) <= Number(record.number_value) &&
    Number(record.number_value) <= Number(record.normal_max)
      ? 'normal'
      : 'abnormal'
  return record.judgment === expected
}

function isStatusInspectionItem(record: Record<string, unknown>): boolean {
  return (
    record.number_value === null &&
    isStatusValue(record.status_value) &&
    record.unit === null &&
    record.normal_min === null &&
    record.normal_max === null &&
    typeof record.normal_state === 'string' &&
    record.normal_state.trim().length >= 1 &&
    record.normal_state.trim().length <= 100 &&
    record.judgment === record.status_value
  )
}

function isInspectionRecordItem(value: unknown): value is InspectionRecordItem {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const hasValidValue =
    record.input_type === 'number'
      ? isNumericInspectionItem(record)
      : record.input_type === 'status' && isStatusInspectionItem(record)
  return (
    isUuid(record.id) &&
    isUuid(record.template_item_id) &&
    typeof record.name === 'string' &&
    record.name.trim().length >= 1 &&
    record.name.trim().length <= 100 &&
    isJudgment(record.judgment) &&
    Number.isInteger(record.display_order) &&
    Number(record.display_order) >= 0 &&
    Number(record.display_order) <= 9999 &&
    hasValidValue
  )
}

function isInspectionRecord(value: unknown): value is InspectionRecord {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (
    !isIsoDate(record.inspection_date) ||
    !isInspectionCycle(record.cycle) ||
    !Array.isArray(record.items)
  ) {
    return false
  }
  const itemsAreValid = record.items.every(isInspectionRecordItem)
  const expectedOverall = record.items.some(
    (item) =>
      typeof item === 'object' &&
      item !== null &&
      (item as Record<string, unknown>).judgment === 'abnormal',
  )
    ? 'abnormal'
    : 'normal'
  return (
    isUuid(record.id) &&
    isUuid(record.equipment_id) &&
    typeof record.equipment_name === 'string' &&
    record.equipment_name.trim().length >= 1 &&
    isNullableString(record.equipment_number) &&
    hasValidPeriodKey(
      record.cycle,
      record.inspection_date,
      record.period_key,
    ) &&
    isJudgment(record.overall_judgment) &&
    record.overall_judgment === expectedOverall &&
    record.items.length >= 1 &&
    record.items.length <= 100 &&
    itemsAreValid &&
    isIsoTimestamp(record.created_at) &&
    isIsoTimestamp(record.updated_at)
  )
}

function isInspectionRecordListResponse(
  value: unknown,
): value is InspectionRecordListResponse {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    Array.isArray(record.items) &&
    record.items.every(isInspectionRecord) &&
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

function createRequestBody(input: InspectionRecordCreateInput): string {
  return JSON.stringify({
    inspection_date: input.inspectionDate,
    equipment_id: input.equipmentId,
    cycle: input.cycle,
    items: input.items.map((item) => ({
      template_item_id: item.templateItemId,
      number_value: item.numberValue,
      status_value: item.statusValue,
    })),
  })
}

export async function fetchInspectionRecords(
  options: InspectionRecordListRequestOptions,
): Promise<InspectionRecordListResponse> {
  if (!isUuid(options.equipmentId)) {
    throw new InspectionRecordApiError(
      'Inspection record equipment filter is invalid',
    )
  }
  const limit = options.limit ?? 5
  const offset = options.offset ?? 0
  if (
    !Number.isInteger(limit) ||
    limit < 1 ||
    limit > 50 ||
    !Number.isInteger(offset) ||
    offset < 0
  ) {
    throw new InspectionRecordApiError(
      'Inspection record page parameters are invalid',
    )
  }
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const query = new URLSearchParams({
    equipment_id: options.equipmentId,
    limit: String(limit),
    offset: String(offset),
  })
  const response = await authenticatedFetch(
    `${baseUrl}/inspection-records?${query}`,
    {
      headers: { Accept: 'application/json' },
      signal: options.signal,
    },
  )
  if (!response.ok) {
    throw new InspectionRecordApiError(
      `Inspection record API returned HTTP ${response.status}`,
      response.status,
    )
  }
  const payload: unknown = await response.json()
  if (!isInspectionRecordListResponse(payload)) {
    throw new InspectionRecordApiError(
      'Inspection record API returned an invalid list response',
    )
  }
  return payload
}

export async function createInspectionRecord(
  input: InspectionRecordCreateInput,
  options: InspectionRecordRequestOptions = {},
): Promise<InspectionRecord> {
  if (
    !isIsoDate(input.inspectionDate) ||
    !isUuid(input.equipmentId) ||
    !isInspectionCycle(input.cycle)
  ) {
    throw new InspectionRecordApiError('Inspection record input is invalid')
  }
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const response = await authenticatedFetch(`${baseUrl}/inspection-records`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: createRequestBody(input),
    signal: options.signal,
  })
  if (!response.ok) {
    throw new InspectionRecordApiError(
      `Inspection record API returned HTTP ${response.status}`,
      response.status,
    )
  }
  const payload: unknown = await response.json()
  if (!isInspectionRecord(payload)) {
    throw new InspectionRecordApiError(
      'Inspection record API returned an invalid response',
    )
  }
  return payload
}
