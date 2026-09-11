import { authenticatedFetch } from '../../auth/api/authenticatedFetch'
import type {
  Department,
  Equipment,
  EquipmentCreateInput,
  Manufacturer,
  ManufacturerCreateInput,
  MasterListResponse,
} from '../types'

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'
export const MAX_EQUIPMENT_PHOTO_BYTES = 10 * 1024 * 1024
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

type EquipmentMasterRequestOptions = {
  readonly baseUrl?: string
  readonly signal?: AbortSignal
}

export class EquipmentMasterApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'EquipmentMasterApiError'
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

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isDepartment(value: unknown): value is Department {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    isUuid(record.id) &&
    typeof record.name === 'string' &&
    record.name.trim().length >= 1 &&
    record.name.trim().length <= 50 &&
    Number.isInteger(record.display_order) &&
    Number(record.display_order) >= 0 &&
    typeof record.is_active === 'boolean' &&
    isIsoTimestamp(record.created_at) &&
    isIsoTimestamp(record.updated_at)
  )
}

function isManufacturer(value: unknown): value is Manufacturer {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    isUuid(record.id) &&
    typeof record.name === 'string' &&
    record.name.trim().length >= 1 &&
    record.name.trim().length <= 100 &&
    typeof record.is_active === 'boolean' &&
    isIsoTimestamp(record.created_at) &&
    isIsoTimestamp(record.updated_at)
  )
}

function isEquipment(value: unknown): value is Equipment {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    isUuid(record.equipment_id) &&
    isUuid(record.department_id) &&
    isUuid(record.manufacturer_id) &&
    typeof record.name === 'string' &&
    record.name.trim().length >= 1 &&
    record.name.trim().length <= 100 &&
    isNullableString(record.equipment_number) &&
    isNullableString(record.model_number) &&
    isNullableString(record.photo_path) &&
    typeof record.is_active === 'boolean' &&
    isIsoTimestamp(record.created_at) &&
    isIsoTimestamp(record.updated_at)
  )
}

function isMasterListResponse<T>(
  value: unknown,
  itemValidator: (item: unknown) => item is T,
): value is MasterListResponse<T> {
  if (typeof value !== 'object' || value === null) {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    Array.isArray(record.items) &&
    record.items.every(itemValidator) &&
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

async function fetchMasterList<T>(
  path: string,
  validator: (item: unknown) => item is T,
  options: EquipmentMasterRequestOptions,
): Promise<MasterListResponse<T>> {
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const response = await authenticatedFetch(`${baseUrl}${path}`, {
    headers: { Accept: 'application/json' },
    signal: options.signal,
  })
  if (!response.ok) {
    throw new EquipmentMasterApiError(
      `Equipment master API returned HTTP ${response.status}`,
      response.status,
    )
  }
  const payload: unknown = await response.json()
  if (!isMasterListResponse(payload, validator)) {
    throw new EquipmentMasterApiError(
      'Equipment master API returned an invalid list response',
    )
  }
  return payload
}

export function fetchDepartments(
  options: EquipmentMasterRequestOptions = {},
): Promise<MasterListResponse<Department>> {
  return fetchMasterList(
    '/departments?limit=100&offset=0',
    isDepartment,
    options,
  )
}

export function fetchActiveDepartments(
  options: EquipmentMasterRequestOptions = {},
): Promise<MasterListResponse<Department>> {
  return fetchMasterList(
    '/departments?limit=100&offset=0&is_active=true',
    isDepartment,
    options,
  )
}

export function fetchManufacturers(
  options: EquipmentMasterRequestOptions = {},
): Promise<MasterListResponse<Manufacturer>> {
  return fetchMasterList(
    '/manufacturers?limit=100&offset=0',
    isManufacturer,
    options,
  )
}

export function fetchActiveManufacturers(
  options: EquipmentMasterRequestOptions = {},
): Promise<MasterListResponse<Manufacturer>> {
  return fetchMasterList(
    '/manufacturers?limit=100&offset=0&is_active=true',
    isManufacturer,
    options,
  )
}

export function fetchActiveEquipment(
  options: EquipmentMasterRequestOptions = {},
): Promise<MasterListResponse<Equipment>> {
  return fetchMasterList(
    '/equipment?limit=100&offset=0&is_active=true',
    isEquipment,
    options,
  )
}

async function createMasterItem<T>(
  path: string,
  body: Record<string, unknown>,
  validator: (value: unknown) => value is T,
  options: EquipmentMasterRequestOptions,
): Promise<T> {
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const response = await authenticatedFetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
    signal: options.signal,
  })
  if (!response.ok) {
    throw new EquipmentMasterApiError(
      `Equipment master API returned HTTP ${response.status}`,
      response.status,
    )
  }
  const payload: unknown = await response.json()
  if (!validator(payload)) {
    throw new EquipmentMasterApiError(
      'Equipment master API returned an invalid item response',
    )
  }
  return payload
}

export function createManufacturer(
  input: ManufacturerCreateInput,
  options: EquipmentMasterRequestOptions = {},
): Promise<Manufacturer> {
  return createMasterItem(
    '/manufacturers',
    { name: input.name.trim(), is_active: true },
    isManufacturer,
    options,
  )
}

export function createEquipment(
  input: EquipmentCreateInput,
  options: EquipmentMasterRequestOptions = {},
): Promise<Equipment> {
  const equipmentNumber = input.equipmentNumber.trim()
  const modelNumber = input.modelNumber.trim()
  return createMasterItem(
    '/equipment',
    {
      department_id: input.departmentId,
      manufacturer_id: input.manufacturerId,
      name: input.name.trim(),
      equipment_number: equipmentNumber || null,
      model_number: modelNumber || null,
      photo_path: null,
      is_active: true,
    },
    isEquipment,
    options,
  )
}

function getEquipmentPhotoUrl(
  equipmentId: string,
  options: EquipmentMasterRequestOptions,
): string {
  if (!isUuid(equipmentId)) {
    throw new EquipmentMasterApiError('Equipment photo ID is invalid')
  }
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  return `${baseUrl}/equipment/${equipmentId}/photo`
}

export async function fetchEquipmentPhoto(
  equipmentId: string,
  options: EquipmentMasterRequestOptions = {},
): Promise<Blob> {
  const response = await authenticatedFetch(
    getEquipmentPhotoUrl(equipmentId, options),
    {
      headers: { Accept: 'image/jpeg' },
      signal: options.signal,
    },
  )
  if (!response.ok) {
    throw new EquipmentMasterApiError(
      `Equipment photo API returned HTTP ${response.status}`,
      response.status,
    )
  }
  const photo = await response.blob()
  if (photo.size === 0 || photo.type !== 'image/jpeg') {
    throw new EquipmentMasterApiError(
      'Equipment photo API returned invalid image data',
    )
  }
  return photo
}

export async function uploadEquipmentPhoto(
  equipmentId: string,
  photo: File,
  options: EquipmentMasterRequestOptions = {},
): Promise<Equipment> {
  const body = new FormData()
  body.append('photo', photo, photo.name)
  const response = await authenticatedFetch(
    getEquipmentPhotoUrl(equipmentId, options),
    {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body,
      signal: options.signal,
    },
  )
  if (!response.ok) {
    throw new EquipmentMasterApiError(
      `Equipment photo API returned HTTP ${response.status}`,
      response.status,
    )
  }
  const payload: unknown = await response.json()
  if (!isEquipment(payload) || payload.equipment_id !== equipmentId) {
    throw new EquipmentMasterApiError(
      'Equipment photo API returned an invalid item response',
    )
  }
  return payload
}

export async function deleteEquipmentPhoto(
  equipmentId: string,
  options: EquipmentMasterRequestOptions = {},
): Promise<void> {
  const response = await authenticatedFetch(
    getEquipmentPhotoUrl(equipmentId, options),
    {
      method: 'DELETE',
      signal: options.signal,
    },
  )
  if (!response.ok) {
    throw new EquipmentMasterApiError(
      `Equipment photo API returned HTTP ${response.status}`,
      response.status,
    )
  }
}
