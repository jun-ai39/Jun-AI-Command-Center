import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { formatBackupSize } from '../backupFormatting'
import { isRestoreConfirmationValid } from '../backupRestore'
import { DatabaseBackupPanel } from './DatabaseBackupPanel'

describe('DatabaseBackupPanel', () => {
  it('explains the verified local operation before the administrator starts it', () => {
    const markup = renderToStaticMarkup(<DatabaseBackupPanel />)

    expect(markup).toContain('ADMIN TOOL / BACKUP')
    expect(markup).toContain('データベースのバックアップ')
    expect(markup).toContain('整合性確認済み')
    expect(markup).toContain('保存先の実パスは画面へ表示しません')
    expect(markup).toContain('>バックアップを作成</button>')
    expect(markup).toContain('保存済みバックアップ')
    expect(markup).toContain('>一覧を確認</button>')
    expect(markup).not.toContain('バックアップ完了')
  })

  it('formats backup sizes without hiding the unit', () => {
    expect(formatBackupSize(512)).toBe('512 B')
    expect(formatBackupSize(2048)).toBe('2.0 KB')
    expect(formatBackupSize(3 * 1024 * 1024)).toBe('3.0 MB')
  })

  it('requires an exact filename before a restore can be scheduled', () => {
    const filename = 'phoenix-backup-20260829T010203456789Z-a1b2c3d4.sqlite3'

    expect(isRestoreConfirmationValid(filename, filename)).toBe(true)
    expect(isRestoreConfirmationValid(filename, ` ${filename}`)).toBe(false)
    expect(isRestoreConfirmationValid(filename, 'different.sqlite3')).toBe(
      false,
    )
    expect(isRestoreConfirmationValid(null, '')).toBe(false)
  })
})
