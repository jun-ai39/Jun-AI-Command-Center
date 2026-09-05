import { authenticatedFetch } from '../../auth/api/authenticatedFetch'
import type {
  EquipmentChangeHistory,
  EquipmentChangeHistoryCreateInput,
  EquipmentChangeHistoryListResponse,
} from '../types'

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type EquipmentChangeHistoryRequestOptions = {
  readonly baseUrl?: string
  readonly signal?: AbortSignal
}

type EquipmentChangeHistoryListOptions =
  EquipmentChangeHistoryRequestOptions & {
    readonly equipmentId: string
    readonly limit?: number
    readonly offset?: number
  }

export class EquipmentChangeHistoryApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'EquipmentChangeHistoryApiError'
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

function isNormalizedText(
  value: unknown,
  minimumLength: number,
  maximumLength: number,
): value is string {
  return (
    typeof value === 'string' &&
    value === value.trim() &&
    value.length >= minimumLength &&
    value.length <= maximumLength
  )
}

function isEquipmentChangeHistory(
  value: unknown,
): value is EquipmentChangeHistory {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    isUuid(record.change_history_id) &&
    isUuid(record.equipment_id) &&
    isIsoDate(record.changed_on) &&
    isNormalizedText(record.improvement_point, 1, 200) &&
    isNormalizedText(record.change_details, 1, 2000) &&
    (record.work_report_id === null || isUuid(record.work_report_id)) &&
    isIsoTimestamp(record.created_at) &&
    isIsoTimestamp(record.updated_at)
  )
}

function isEquipmentChangeHistoryListResponse(
  value: unknown,
): value is EquipmentChangeHistoryListResponse {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    Array.isArray(record.items) &&
    record.items.every(isEquipmentChangeHistory) &&
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

function normalizeCreateInput(input: EquipmentChangeHistoryCreateInput): {
  readonly equipmentId: string
  readonly changedOn: string
  readonly improvementPoint: string
  readonly changeDetails: string
  readonly workReportId: string | null
} | null {
  const improvementPoint = input.improvementPoint.trim()
  const changeDetails = input.changeDetails.trim()
  if (
    !isUuid(input.equipmentId) ||
    !isIsoDate(input.changedOn) ||
    improvementPoint.length < 1 ||
    improvementPoint.length > 200 ||
    changeDetails.length < 1 ||
    changeDetails.length > 2000 ||
    (input.workReportId !== null && !isUuid(input.workReportId))
  ) {
    return null
  }
  return {
    equipmentId: input.equipmentId,
    changedOn: input.changedOn,
    improvementPoint,
    changeDetails,
    workReportId: input.workReportId,
  }
}

export async function fetchEquipmentChangeHistories(
  options: EquipmentChangeHistoryListOptions,
): Promise<EquipmentChangeHistoryListResponse> {
  if (!isUuid(options.equipmentId)) {
    throw new EquipmentChangeHistoryApiError(
      'Equipment change history equipment filter is invalid',
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
    throw new EquipmentChangeHistoryApiError(
      'Equipment change history page parameters are invalid',
    )
  }

  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const query = new URLSearchParams({
    equipment_id: options.equipmentId,
    limit: String(limit),
    offset: String(offset),
  })
  const response = await authenticatedFetch(
    `${baseUrl}/equipment-change-histories?${query}`,
    {
      headers: { Accept: 'application/json' },
      signal: options.signal,
    },
  )
  if (!response.ok) {
    throw new EquipmentChangeHistoryApiError(
      `Equipment change history API returned HTTP ${response.status}`,
      response.status,
    )
  }
  const payload: unknown = await response.json()
  if (
    !isEquipmentChangeHistoryListResponse(payload) ||
    payload.items.some((item) => item.equipment_id !== options.equipmentId)
  ) {
    throw new EquipmentChangeHistoryApiError(
      'Equipment change history API returned an invalid list response',
    )
  }
  return payload
}

export async function createEquipmentChangeHistory(
  input: EquipmentChangeHistoryCreateInput,
  options: EquipmentChangeHistoryRequestOptions = {},
): Promise<EquipmentChangeHistory> {
  const normalized = normalizeCreateInput(input)
  if (!normalized) {
    throw new EquipmentChangeHistoryApiError(
      'Equipment change history input is invalid',
    )
  }
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const response = await authenticatedFetch(
    `${baseUrl}/equipment-change-histories`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        equipment_id: normalized.equipmentId,
        changed_on: normalized.changedOn,
        improvement_point: normalized.improvementPoint,
        change_details: normalized.changeDetails,
        work_report_id: normalized.workReportId,
      }),
      signal: options.signal,
    },
  )
  if (!response.ok) {
    throw new EquipmentChangeHistoryApiError(
      `Equipment change history API returned HTTP ${response.status}`,
      response.status,
    )
  }
  const payload: unknown = await response.json()
  if (
    !isEquipmentChangeHistory(payload) ||
    payload.equipment_id !== normalized.equipmentId ||
    payload.changed_on !== normalized.changedOn ||
    payload.improvement_point !== normalized.improvementPoint ||
    payload.change_details !== normalized.changeDetails ||
    payload.work_report_id !== normalized.workReportId
  ) {
    throw new EquipmentChangeHistoryApiError(
      'Equipment change history API returned an invalid item response',
    )
  }
  return payload
}
