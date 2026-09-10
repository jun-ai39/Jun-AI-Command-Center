import { useState } from 'react'

import {
  BackupApiError,
  createDatabaseBackup,
  fetchDatabaseBackups,
  scheduleDatabaseRestore,
} from '../api/backups'
import { formatBackupSize } from '../backupFormatting'
import { isRestoreConfirmationValid } from '../backupRestore'
import type {
  BackupCatalog,
  DatabaseBackup,
  ScheduledDatabaseRestore,
} from '../types'
import './DatabaseBackupPanel.css'

type BackupPanelState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'creating' }
  | { readonly phase: 'created'; readonly backup: DatabaseBackup }
  | { readonly phase: 'error'; readonly message: string }

type CatalogState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'loading' }
  | { readonly phase: 'loaded'; readonly catalog: BackupCatalog }
  | { readonly phase: 'error'; readonly message: string }

type RestoreOperationState =
  | { readonly phase: 'idle' }
  | { readonly phase: 'scheduling' }
  | { readonly phase: 'scheduled'; readonly result: ScheduledDatabaseRestore }
  | { readonly phase: 'error'; readonly message: string }

function formatCreatedAt(timestamp: string): string {
  return new Intl.DateTimeFormat('ja-JP', {
    dateStyle: 'medium',
    timeStyle: 'medium',
    timeZone: 'Asia/Tokyo',
  }).format(new Date(timestamp))
}

function getBackupErrorMessage(error: unknown): string {
  if (error instanceof BackupApiError && error.status === 403) {
    return 'バックアップの作成には管理者権限が必要です。'
  }
  if (error instanceof BackupApiError && error.status === 409) {
    return 'バックアップ対象のSQLiteデータベースを確認できませんでした。'
  }
  return 'バックアップを作成できませんでした。データベースと保存先を確認し、もう一度お試しください。'
}

export function DatabaseBackupPanel() {
  const [state, setState] = useState<BackupPanelState>({ phase: 'idle' })
  const [catalogState, setCatalogState] = useState<CatalogState>({
    phase: 'idle',
  })
  const [selectedFilename, setSelectedFilename] = useState<string | null>(null)
  const [confirmation, setConfirmation] = useState('')
  const [restoreState, setRestoreState] = useState<RestoreOperationState>({
    phase: 'idle',
  })

  async function loadCatalog() {
    setCatalogState({ phase: 'loading' })
    try {
      const catalog = await fetchDatabaseBackups()
      setCatalogState({ phase: 'loaded', catalog })
      if (!catalog.items.some((item) => item.filename === selectedFilename)) {
        setSelectedFilename(null)
        setConfirmation('')
      }
    } catch {
      setCatalogState({
        phase: 'error',
        message:
          'バックアップ一覧を読み込めませんでした。もう一度お試しください。',
      })
    }
  }

  async function handleCreateBackup() {
    setState({ phase: 'creating' })
    try {
      const backup = await createDatabaseBackup()
      setState({ phase: 'created', backup })
      await loadCatalog()
    } catch (error) {
      setState({ phase: 'error', message: getBackupErrorMessage(error) })
    }
  }

  async function handleScheduleRestore() {
    const filename = selectedFilename
    if (!isRestoreConfirmationValid(filename, confirmation) || !filename) return
    setRestoreState({ phase: 'scheduling' })
    try {
      const result = await scheduleDatabaseRestore({
        filename,
        confirmation,
      })
      setRestoreState({ phase: 'scheduled', result })
      await loadCatalog()
    } catch (error) {
      setRestoreState({
        phase: 'error',
        message:
          error instanceof BackupApiError && error.status === 409
            ? 'このバックアップは安全に復元できないか、別の復元が再起動待ちです。'
            : '復元を予約できませんでした。バックアップの状態を確認してください。',
      })
    }
  }

  function selectBackup(filename: string) {
    setSelectedFilename(filename)
    setConfirmation('')
    setRestoreState({ phase: 'idle' })
  }

  return (
    <section
      id="database-backup-management"
      className="admin-settings-tool database-backup"
      aria-labelledby="database-backup-title"
    >
      <div className="admin-settings-tool-heading">
        <div>
          <small>ADMIN TOOL / STEP 132</small>
          <h2 id="database-backup-title">データベースのバックアップ</h2>
        </div>
        <p>
          現在のPhoenixデータを、整合性確認済みのSQLiteファイルとしてこのPC内へ保存します。
        </p>
      </div>

      <div className="database-backup-card">
        <div>
          <h3>手動バックアップ</h3>
          <p>
            作成中もデータベースを直接コピーせず、完了後に正常性を確認します。保存先の実パスは画面へ表示しません。
          </p>
        </div>
        <button
          type="button"
          disabled={state.phase === 'creating'}
          onClick={() => void handleCreateBackup()}
        >
          {state.phase === 'creating'
            ? 'バックアップ作成中…'
            : 'バックアップを作成'}
        </button>
      </div>

      {state.phase === 'created' && (
        <div className="database-backup-result is-success" role="status">
          <strong>バックアップ完了</strong>
          <dl>
            <div>
              <dt>作成日時</dt>
              <dd>{formatCreatedAt(state.backup.created_at)}</dd>
            </div>
            <div>
              <dt>ファイル名</dt>
              <dd>{state.backup.filename}</dd>
            </div>
            <div>
              <dt>容量</dt>
              <dd>{formatBackupSize(state.backup.size_bytes)}</dd>
            </div>
            <div>
              <dt>整合性</dt>
              <dd>正常</dd>
            </div>
          </dl>
        </div>
      )}

      {state.phase === 'error' && (
        <div className="database-backup-result is-error" role="alert">
          <strong>バックアップ未完了</strong>
          <p>{state.message}</p>
        </div>
      )}

      <div className="database-backup-catalog-heading">
        <div>
          <h3>保存済みバックアップ</h3>
          <p>整合性が正常なファイルだけを、次回起動時の復元対象にできます。</p>
        </div>
        <button
          type="button"
          disabled={catalogState.phase === 'loading'}
          onClick={() => void loadCatalog()}
        >
          {catalogState.phase === 'loading' ? '確認中…' : '一覧を確認'}
        </button>
      </div>

      {catalogState.phase === 'error' && (
        <p className="database-backup-catalog-error" role="alert">
          {catalogState.message}
        </p>
      )}

      {catalogState.phase === 'loaded' && (
        <div className="database-backup-catalog">
          {catalogState.catalog.restore_status.phase === 'pending' && (
            <div className="database-restore-restart" role="status">
              <strong>復元予約済み／APIの再起動が必要です</strong>
              <p>
                稼働中のデータはまだ置き換えていません。Phoenix
                APIを停止して再起動すると、安全確認後に復元されます。
              </p>
            </div>
          )}

          {catalogState.catalog.items.length === 0 ? (
            <p className="database-backup-empty">
              保存済みバックアップはありません。
            </p>
          ) : (
            <ul className="database-backup-list">
              {catalogState.catalog.items.map((backup) => (
                <li key={backup.filename}>
                  <label>
                    <input
                      type="radio"
                      name="restore-backup"
                      value={backup.filename}
                      checked={selectedFilename === backup.filename}
                      disabled={
                        !backup.restorable ||
                        catalogState.catalog.restore_status.phase === 'pending'
                      }
                      onChange={() => selectBackup(backup.filename)}
                    />
                    <span>
                      <strong>{backup.filename}</strong>
                      <small>
                        {formatCreatedAt(backup.created_at)} /{' '}
                        {formatBackupSize(backup.size_bytes)} /{' '}
                        {backup.integrity_status === 'ok'
                          ? '整合性：正常'
                          : '整合性：異常・復元不可'}
                      </small>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          )}

          {selectedFilename &&
            catalogState.catalog.restore_status.phase !== 'pending' && (
              <div className="database-restore-confirmation">
                <h3>次回起動時に復元</h3>
                <p>
                  復元前の状態も安全バックアップします。確認のため、選択したファイル名をそのまま入力してください。
                </p>
                <code>{selectedFilename}</code>
                <input
                  type="text"
                  aria-label="復元するバックアップのファイル名を確認入力"
                  value={confirmation}
                  autoComplete="off"
                  onChange={(event) => setConfirmation(event.target.value)}
                />
                <button
                  type="button"
                  disabled={
                    restoreState.phase === 'scheduling' ||
                    !isRestoreConfirmationValid(selectedFilename, confirmation)
                  }
                  onClick={() => void handleScheduleRestore()}
                >
                  {restoreState.phase === 'scheduling'
                    ? '復元準備中…'
                    : '復元を予約'}
                </button>
              </div>
            )}
        </div>
      )}

      {restoreState.phase === 'scheduled' && (
        <div className="database-backup-result is-success" role="status">
          <strong>復元予約が完了しました</strong>
          <p>
            現在のデータも「{restoreState.result.safety_backup_filename}
            」へ退避しました。APIを再起動すると復元が適用され、再ログインが必要になります。
          </p>
        </div>
      )}

      {restoreState.phase === 'error' && (
        <div className="database-backup-result is-error" role="alert">
          <strong>復元予約は未完了です</strong>
          <p>{restoreState.message}</p>
        </div>
      )}
    </section>
  )
}
