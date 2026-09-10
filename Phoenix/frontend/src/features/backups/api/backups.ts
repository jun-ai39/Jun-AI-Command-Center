import { authenticatedFetch } from '../../auth/api/authenticatedFetch'
import type {
  BackupCatalog,
  DatabaseBackup,
  RestoreStatus,
  ScheduledDatabaseRestore,
  StoredDatabaseBackup,
} from '../types'

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'
const BACKUP_FILENAME_PATTERN =
  /^phoenix-backup-\d{8}T\d{12}Z-[0-9a-f]{8}\.sqlite3$/

type CreateBackupOptions = {
  readonly baseUrl?: string
  readonly signal?: AbortSignal
}

type ScheduleRestoreOptions = CreateBackupOptions & {
  readonly filename: string
  readonly confirmation: string
}

export class BackupApiError extends Error {
  readonly status: number | null

  constructor(message: string, status: number | null = null) {
    super(message)
    this.name = 'BackupApiError'
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

function isDatabaseBackup(value: unknown): value is DatabaseBackup {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const expectedKeys = new Set([
    'filename',
    'created_at',
    'size_bytes',
    'integrity_status',
  ])
  return (
    Object.keys(record).length === expectedKeys.size &&
    Object.keys(record).every((key) => expectedKeys.has(key)) &&
    typeof record.filename === 'string' &&
    BACKUP_FILENAME_PATTERN.test(record.filename) &&
    typeof record.created_at === 'string' &&
    !Number.isNaN(Date.parse(record.created_at)) &&
    Number.isInteger(record.size_bytes) &&
    Number(record.size_bytes) > 0 &&
    record.integrity_status === 'ok'
  )
}

function hasExactKeys(
  record: Record<string, unknown>,
  expectedKeys: readonly string[],
): boolean {
  const keys = Object.keys(record)
  const expected = new Set(expectedKeys)
  return keys.length === expected.size && keys.every((key) => expected.has(key))
}

function isStoredDatabaseBackup(value: unknown): value is StoredDatabaseBackup {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    hasExactKeys(record, [
      'filename',
      'created_at',
      'size_bytes',
      'integrity_status',
      'restorable',
    ]) &&
    typeof record.filename === 'string' &&
    BACKUP_FILENAME_PATTERN.test(record.filename) &&
    typeof record.created_at === 'string' &&
    !Number.isNaN(Date.parse(record.created_at)) &&
    Number.isInteger(record.size_bytes) &&
    Number(record.size_bytes) >= 0 &&
    (record.integrity_status === 'ok' ||
      record.integrity_status === 'invalid') &&
    typeof record.restorable === 'boolean' &&
    record.restorable === (record.integrity_status === 'ok')
  )
}

function isRestoreStatus(value: unknown): value is RestoreStatus {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  const validFilename = (candidate: unknown) =>
    candidate === null ||
    (typeof candidate === 'string' && BACKUP_FILENAME_PATTERN.test(candidate))
  return (
    hasExactKeys(record, [
      'phase',
      'filename',
      'safety_backup_filename',
      'restart_required',
    ]) &&
    ['none', 'pending', 'completed', 'failed'].includes(String(record.phase)) &&
    validFilename(record.filename) &&
    validFilename(record.safety_backup_filename) &&
    typeof record.restart_required === 'boolean' &&
    record.restart_required === (record.phase === 'pending')
  )
}

function isBackupCatalog(value: unknown): value is BackupCatalog {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    hasExactKeys(record, ['items', 'total', 'restore_status']) &&
    Array.isArray(record.items) &&
    record.items.every(isStoredDatabaseBackup) &&
    Number.isInteger(record.total) &&
    Number(record.total) === record.items.length &&
    isRestoreStatus(record.restore_status)
  )
}

function isScheduledRestore(value: unknown): value is ScheduledDatabaseRestore {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    hasExactKeys(record, [
      'filename',
      'safety_backup_filename',
      'restart_required',
    ]) &&
    typeof record.filename === 'string' &&
    BACKUP_FILENAME_PATTERN.test(record.filename) &&
    typeof record.safety_backup_filename === 'string' &&
    BACKUP_FILENAME_PATTERN.test(record.safety_backup_filename) &&
    record.restart_required === true
  )
}

export async function createDatabaseBackup(
  options: CreateBackupOptions = {},
): Promise<DatabaseBackup> {
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const response = await authenticatedFetch(`${baseUrl}/backups`, {
    method: 'POST',
    headers: { Accept: 'application/json' },
    signal: options.signal,
  })
  if (!response.ok) {
    throw new BackupApiError(
      `Backup API returned HTTP ${response.status}`,
      response.status,
    )
  }
  const payload: unknown = await response.json()
  if (!isDatabaseBackup(payload)) {
    throw new BackupApiError('Backup API returned an invalid response')
  }
  return payload
}

export async function fetchDatabaseBackups(
  options: CreateBackupOptions = {},
): Promise<BackupCatalog> {
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const response = await authenticatedFetch(`${baseUrl}/backups`, {
    headers: { Accept: 'application/json' },
    signal: options.signal,
  })
  if (!response.ok) {
    throw new BackupApiError(
      `Backup API returned HTTP ${response.status}`,
      response.status,
    )
  }
  const payload: unknown = await response.json()
  if (!isBackupCatalog(payload)) {
    throw new BackupApiError('Backup API returned an invalid catalog response')
  }
  return payload
}

export async function scheduleDatabaseRestore(
  options: ScheduleRestoreOptions,
): Promise<ScheduledDatabaseRestore> {
  if (
    !BACKUP_FILENAME_PATTERN.test(options.filename) ||
    options.confirmation !== options.filename
  ) {
    throw new BackupApiError('Restore confirmation is invalid')
  }
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const response = await authenticatedFetch(
    `${baseUrl}/backups/${encodeURIComponent(options.filename)}/restore`,
    {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ confirmation: options.confirmation }),
      signal: options.signal,
    },
  )
  if (!response.ok) {
    throw new BackupApiError(
      `Backup API returned HTTP ${response.status}`,
      response.status,
    )
  }
  const payload: unknown = await response.json()
  if (!isScheduledRestore(payload) || payload.filename !== options.filename) {
    throw new BackupApiError('Backup API returned an invalid restore response')
  }
  return payload
}
