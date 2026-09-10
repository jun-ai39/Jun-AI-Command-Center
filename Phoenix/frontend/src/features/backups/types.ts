export type DatabaseBackup = {
  readonly filename: string
  readonly created_at: string
  readonly size_bytes: number
  readonly integrity_status: 'ok'
}

export type StoredDatabaseBackup = {
  readonly filename: string
  readonly created_at: string
  readonly size_bytes: number
  readonly integrity_status: 'ok' | 'invalid'
  readonly restorable: boolean
}

export type RestoreStatus = {
  readonly phase: 'none' | 'pending' | 'completed' | 'failed'
  readonly filename: string | null
  readonly safety_backup_filename: string | null
  readonly restart_required: boolean
}

export type BackupCatalog = {
  readonly items: readonly StoredDatabaseBackup[]
  readonly total: number
  readonly restore_status: RestoreStatus
}

export type ScheduledDatabaseRestore = {
  readonly filename: string
  readonly safety_backup_filename: string
  readonly restart_required: true
}
