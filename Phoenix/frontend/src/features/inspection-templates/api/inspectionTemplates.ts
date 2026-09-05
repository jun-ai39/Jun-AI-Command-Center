import { authenticatedFetch } from '../../auth/api/authenticatedFetch'
import type {
  InspectionCycle,
  InspectionInputType,
  InspectionTemplateCreateInput,
  InspectionTemplateGuideUpdateInput,
  InspectionTemplateItem,
  InspectionTemplateItemListResponse,
} from '../types'

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type InspectionTemplateRequestOptions = {
  readonly baseUrl?: string
  readonly signal?: AbortSignal
}

type InspectionTemplateListRequestOptions = InspectionTemplateRequestOptions & {
  readonly cycle?: InspectionCycle
  readonly isActive?: boolean
}

export class InspectionTemplateApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'InspectionTemplateApiError'
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

function isIsoTimestamp(value: unknown): value is string {
  return typeof value === 'string' && !Number.isNaN(Date.parse(value))
}

function isInspectionCycle(value: unknown): value is InspectionCycle {
  return value === 'daily' || value === 'weekly' || value === 'monthly'
}

function isInspectionInputType(value: unknown): value is InspectionInputType {
  return value === 'number' || value === 'status'
}

function isNullableNumber(value: unknown): value is number | null {
  return value === null || (typeof value === 'number' && Number.isFinite(value))
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isNullableGuideText(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === 'string' &&
      value.trim().length >= 1 &&
      value.trim().length <= 300)
  )
}

function hasValidNormalRule(record: Record<string, unknown>): boolean {
  if (!isInspectionInputType(record.input_type)) return false
  if (record.input_type === 'number') {
    return (
      typeof record.normal_min === 'number' &&
      Number.isFinite(record.normal_min) &&
      typeof record.normal_max === 'number' &&
      Number.isFinite(record.normal_max) &&
      record.normal_min <= record.normal_max &&
      record.normal_state === null &&
      isNullableString(record.unit) &&
      (record.unit === null ||
        (record.unit.trim().length >= 1 && record.unit.trim().length <= 30))
    )
  }
  return (
    record.normal_min === null &&
    record.normal_max === null &&
    record.unit === null &&
    typeof record.normal_state === 'string' &&
    record.normal_state.trim().length >= 1 &&
    record.normal_state.trim().length <= 100
  )
}

function isInspectionTemplateItem(
  value: unknown,
): value is InspectionTemplateItem {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    isUuid(record.id) &&
    isUuid(record.equipment_id) &&
    isInspectionCycle(record.cycle) &&
    typeof record.name === 'string' &&
    record.name.trim().length >= 1 &&
    record.name.trim().length <= 100 &&
    isInspectionInputType(record.input_type) &&
    isNullableString(record.unit) &&
    isNullableNumber(record.normal_min) &&
    isNullableNumber(record.normal_max) &&
    isNullableString(record.normal_state) &&
    isNullableGuideText(record.check_method) &&
    isNullableGuideText(record.caution_note) &&
    hasValidNormalRule(record) &&
    Number.isInteger(record.display_order) &&
    Number(record.display_order) >= 0 &&
    Number(record.display_order) <= 9999 &&
    typeof record.is_active === 'boolean' &&
    isIsoTimestamp(record.created_at) &&
    isIsoTimestamp(record.updated_at)
  )
}

function isInspectionTemplateListResponse(
  value: unknown,
): value is InspectionTemplateItemListResponse {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    Array.isArray(record.items) &&
    record.items.every(isInspectionTemplateItem) &&
    Number.isInteger(record.total) &&
    Number(record.total) >= 0 &&
    Number.isInteger(record.limit) &&
    Number(record.limit) >= 1 &&
    Number(record.limit) <= 100 &&
    Number.isInteger(record.offset) &&
    Number(record.offset) >= 0 &&
    record.items.length <= Number(record.limit) &&
    record.items.length <= Number(record.total)
  )
}

export async function fetchInspectionTemplateItems(
  equipmentId: string,
  options: InspectionTemplateListRequestOptions = {},
): Promise<InspectionTemplateItemListResponse> {
  if (!isUuid(equipmentId)) {
    throw new InspectionTemplateApiError('Inspection equipment ID is invalid')
  }
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const query = new URLSearchParams({
    equipment_id: equipmentId,
    limit: '100',
    offset: '0',
  })
  if (options.cycle !== undefined) {
    if (!isInspectionCycle(options.cycle)) {
      throw new InspectionTemplateApiError('Inspection cycle is invalid')
    }
    query.set('cycle', options.cycle)
  }
  if (options.isActive !== undefined) {
    query.set('is_active', String(options.isActive))
  }
  const response = await authenticatedFetch(
    `${baseUrl}/inspection-template-items?${query}`,
    {
      headers: { Accept: 'application/json' },
      signal: options.signal,
    },
  )
  if (!response.ok) {
    throw new InspectionTemplateApiError(
      `Inspection template API returned HTTP ${response.status}`,
      response.status,
    )
  }
  const payload: unknown = await response.json()
  if (!isInspectionTemplateListResponse(payload)) {
    throw new InspectionTemplateApiError(
      'Inspection template API returned an invalid list response',
    )
  }
  return payload
}

export async function createInspectionTemplateItem(
  input: InspectionTemplateCreateInput,
  options: InspectionTemplateRequestOptions = {},
): Promise<InspectionTemplateItem> {
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const isNumber = input.inputType === 'number'
  const unit = input.unit.trim()
  const normalState = input.normalState.trim()
  const checkMethod = input.checkMethod.trim()
  const cautionNote = input.cautionNote.trim()
  const response = await authenticatedFetch(
    `${baseUrl}/inspection-template-items`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        equipment_id: input.equipmentId,
        cycle: input.cycle,
        name: input.name.trim(),
        input_type: input.inputType,
        unit: isNumber && unit ? unit : null,
        normal_min: isNumber ? input.normalMin : null,
        normal_max: isNumber ? input.normalMax : null,
        normal_state: isNumber ? null : normalState,
        check_method: checkMethod || null,
        caution_note: cautionNote || null,
        display_order: input.displayOrder,
        is_active: input.isActive,
      }),
      signal: options.signal,
    },
  )
  if (!response.ok) {
    throw new InspectionTemplateApiError(
      `Inspection template API returned HTTP ${response.status}`,
      response.status,
    )
  }
  const payload: unknown = await response.json()
  if (!isInspectionTemplateItem(payload)) {
    throw new InspectionTemplateApiError(
      'Inspection template API returned an invalid item response',
    )
  }
  return payload
}

export async function updateInspectionTemplateGuide(
  input: InspectionTemplateGuideUpdateInput,
  options: InspectionTemplateRequestOptions = {},
): Promise<InspectionTemplateItem> {
  if (!isUuid(input.itemId)) {
    throw new InspectionTemplateApiError('Inspection item ID is invalid')
  }
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const checkMethod = input.checkMethod.trim()
  const cautionNote = input.cautionNote.trim()
  const response = await authenticatedFetch(
    `${baseUrl}/inspection-template-items/${input.itemId}/guide`,
    {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        check_method: checkMethod || null,
        caution_note: cautionNote || null,
      }),
      signal: options.signal,
    },
  )
  if (!response.ok) {
    throw new InspectionTemplateApiError(
      `Inspection template API returned HTTP ${response.status}`,
      response.status,
    )
  }
  const payload: unknown = await response.json()
  if (!isInspectionTemplateItem(payload)) {
    throw new InspectionTemplateApiError(
      'Inspection template API returned an invalid item response',
    )
  }
  return payload
}
