import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  BackupApiError,
  createDatabaseBackup,
  fetchDatabaseBackups,
  scheduleDatabaseRestore,
} from './backups'

const completedBackup = {
  filename: 'phoenix-backup-20260829T010203456789Z-a1b2c3d4.sqlite3',
  created_at: '2026-08-29T01:02:03.456789+00:00',
  size_bytes: 28672,
  integrity_status: 'ok',
}
const catalog = {
  items: [{ ...completedBackup, restorable: true }],
  total: 1,
  restore_status: {
    phase: 'none',
    filename: null,
    safety_backup_filename: null,
    restart_required: false,
  },
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('database backup API', () => {
  it('creates one authenticated backup without a request body', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(completedBackup, 201))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createDatabaseBackup({ baseUrl: 'https://api.example.test/' }),
    ).resolves.toEqual(completedBackup)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/backups',
      expect.objectContaining({
        method: 'POST',
        headers: { Accept: 'application/json' },
        credentials: 'include',
      }),
    )
    expect(fetchMock.mock.calls[0]?.[1]).not.toHaveProperty('body')
  })

  it('keeps permission and server failure status for the screen', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 403 })),
    )
    await expect(
      createDatabaseBackup({ baseUrl: 'https://api.example.test' }),
    ).rejects.toMatchObject({ status: 403 })

    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 500 })),
    )
    await expect(
      createDatabaseBackup({ baseUrl: 'https://api.example.test' }),
    ).rejects.toMatchObject({ status: 500 })
  })

  it('rejects malformed metadata instead of showing false success', async () => {
    for (const malformed of [
      { ...completedBackup, filename: '../phoenix.sqlite3' },
      { ...completedBackup, created_at: 'invalid' },
      { ...completedBackup, size_bytes: 0 },
      { ...completedBackup, integrity_status: 'unchecked' },
      { ...completedBackup, private_path: 'C:/private/phoenix.sqlite3' },
    ]) {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(malformed, 201)),
      )
      await expect(
        createDatabaseBackup({ baseUrl: 'https://api.example.test' }),
      ).rejects.toThrow(BackupApiError)
    }
  })

  it('loads verified backups with the current restore state', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(catalog))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchDatabaseBackups({ baseUrl: 'https://api.example.test/' }),
    ).resolves.toEqual(catalog)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/backups',
      expect.objectContaining({ credentials: 'include' }),
    )
  })

  it('rejects a contradictory or path-bearing backup catalog', async () => {
    for (const malformed of [
      { ...catalog, total: 2 },
      {
        ...catalog,
        items: [{ ...catalog.items[0], restorable: false }],
      },
      {
        ...catalog,
        restore_status: {
          ...catalog.restore_status,
          private_path: 'C:/private',
        },
      },
    ]) {
      vi.stubGlobal(
        'fetch',
        vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(malformed)),
      )
      await expect(
        fetchDatabaseBackups({ baseUrl: 'https://api.example.test' }),
      ).rejects.toThrow(BackupApiError)
    }
  })

  it('stages an exact confirmed restore and requires restart', async () => {
    const restored = {
      filename: completedBackup.filename,
      safety_backup_filename:
        'phoenix-backup-20260829T020304567890Z-b2c3d4e5.sqlite3',
      restart_required: true,
    }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(restored, 202))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      scheduleDatabaseRestore({
        baseUrl: 'https://api.example.test/',
        filename: completedBackup.filename,
        confirmation: completedBackup.filename,
      }),
    ).resolves.toEqual(restored)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/backups/${completedBackup.filename}/restore`,
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ confirmation: completedBackup.filename }),
      }),
    )
  })

  it('rejects restore mismatches before sending a destructive request', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      scheduleDatabaseRestore({
        filename: completedBackup.filename,
        confirmation: 'different.sqlite3',
      }),
    ).rejects.toThrow(BackupApiError)
    await expect(
      scheduleDatabaseRestore({
        filename: '../phoenix.sqlite3',
        confirmation: '../phoenix.sqlite3',
      }),
    ).rejects.toThrow(BackupApiError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
