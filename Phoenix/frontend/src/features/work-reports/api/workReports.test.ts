import { afterEach, describe, expect, it, vi } from 'vitest'

import { TEST_DEPARTMENT_ID, TEST_EQUIPMENT_ID } from '../testFixtures'
import {
  createWorkReport,
  fetchWorkReportAttentionSummary,
  fetchWorkReports,
  updateWorkReport,
  WorkReportApiError,
} from './workReports'

afterEach(() => vi.unstubAllGlobals())

const confirmation = {
  workDate: '2026-08-21',
  departmentId: TEST_DEPARTMENT_ID,
  equipmentId: TEST_EQUIPMENT_ID,
  phenomenon: '  搬送部から周期的な異音  ',
  cause: '   ',
  workContent: '  安全な範囲で外観を確認  ',
  progress: 'follow_up' as const,
}

const responsePayload = {
  id: '9b73f331-d416-41c8-b5e2-6f3e53b7ac31',
  work_date: '2026-08-21',
  department_id: TEST_DEPARTMENT_ID,
  equipment_id: TEST_EQUIPMENT_ID,
  department_name: '菓子パン',
  equipment_name: '包装機',
  equipment_number: 'No.2',
  phenomenon: '搬送部から周期的な異音',
  cause: null,
  work_content: '安全な範囲で外観を確認',
  progress: 'follow_up',
  is_legacy: false,
  legacy_category: null,
  legacy_work_hours: null,
  legacy_notes: null,
  created_at: '2026-08-21T01:00:00+00:00',
  updated_at: '2026-08-21T01:00:00+00:00',
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('createWorkReport', () => {
  it('posts the seven normalized fields and accepts a validated report', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(responsePayload, 201))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createWorkReport(confirmation, { baseUrl: 'https://api.example.test/' }),
    ).resolves.toEqual(responsePayload)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/work-reports',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          work_date: '2026-08-21',
          department_id: TEST_DEPARTMENT_ID,
          equipment_id: TEST_EQUIPMENT_ID,
          phenomenon: '搬送部から周期的な異音',
          cause: null,
          work_content: '安全な範囲で外観を確認',
          progress: 'follow_up',
        }),
      }),
    )
  })

  it('rejects HTTP failures and malformed report responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 503 })),
    )
    await expect(
      createWorkReport(confirmation, { baseUrl: 'https://api.example.test' }),
    ).rejects.toThrow(WorkReportApiError)

    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          jsonResponse({ ...responsePayload, progress: 'unknown' }, 201),
        ),
    )
    await expect(
      createWorkReport(confirmation, { baseUrl: 'https://api.example.test' }),
    ).rejects.toThrow(WorkReportApiError)
  })
})

describe('fetchWorkReports', () => {
  it('gets a page using basic, progress, and equipment filters', async () => {
    const payload = { items: [responsePayload], total: 7, limit: 5, offset: 0 }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(payload))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchWorkReports({
        baseUrl: 'https://api.example.test/',
        workDate: '2026-08-21',
        departmentId: TEST_DEPARTMENT_ID,
        workContentQuery: '  外観を確認  ',
        progress: 'follow_up',
        equipmentId: TEST_EQUIPMENT_ID,
      }),
    ).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/work-reports?limit=5&offset=0&work_date=2026-08-21&department_id=${TEST_DEPARTMENT_ID}&work_content_query=${encodeURIComponent('外観を確認')}&progress=follow_up&equipment_id=${TEST_EQUIPMENT_ID}`,
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('accepts a fully unassigned legacy report with old details', async () => {
    const legacyReport = {
      ...responsePayload,
      department_id: null,
      equipment_id: null,
      department_name: null,
      equipment_name: null,
      equipment_number: null,
      phenomenon: null,
      is_legacy: true,
      legacy_category: 'maintenance',
      legacy_work_hours: 1.5,
      legacy_notes: '架空部品の入荷待ち',
    }
    const payload = { items: [legacyReport], total: 1, limit: 5, offset: 0 }
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(payload)),
    )
    await expect(
      fetchWorkReports({ baseUrl: 'https://api.example.test' }),
    ).resolves.toEqual(payload)
  })

  it('rejects invalid filters before requesting', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)
    await expect(
      fetchWorkReports({
        baseUrl: 'https://api.example.test',
        workDate: '2026-02-30',
      }),
    ).rejects.toThrow(WorkReportApiError)
    await expect(
      fetchWorkReports({
        baseUrl: 'https://api.example.test',
        progress: 'unknown' as never,
      }),
    ).rejects.toThrow(WorkReportApiError)
    await expect(
      fetchWorkReports({
        baseUrl: 'https://api.example.test',
        departmentId: 'not-a-uuid',
      }),
    ).rejects.toThrow(WorkReportApiError)
    await expect(
      fetchWorkReports({
        baseUrl: 'https://api.example.test',
        workContentQuery: '   ',
      }),
    ).rejects.toThrow(WorkReportApiError)
    await expect(
      fetchWorkReports({
        baseUrl: 'https://api.example.test',
        workContentQuery: 'x'.repeat(201),
      }),
    ).rejects.toThrow(WorkReportApiError)
    await expect(
      fetchWorkReports({
        baseUrl: 'https://api.example.test',
        equipmentId: 'not-a-uuid',
      }),
    ).rejects.toThrow(WorkReportApiError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects partial equipment links and inconsistent legacy flags', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          items: [{ ...responsePayload, equipment_id: null }],
          total: 1,
          limit: 5,
          offset: 0,
        }),
      ),
    )
    await expect(
      fetchWorkReports({ baseUrl: 'https://api.example.test' }),
    ).rejects.toThrow(WorkReportApiError)

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          items: [{ ...responsePayload, is_legacy: true }],
          total: 1,
          limit: 5,
          offset: 0,
        }),
      ),
    )
    await expect(
      fetchWorkReports({ baseUrl: 'https://api.example.test' }),
    ).rejects.toThrow(WorkReportApiError)
  })
})

describe('fetchWorkReportAttentionSummary', () => {
  it('accepts consistent saved-report attention counts', async () => {
    const payload = {
      continued_count: 2,
      follow_up_count: 1,
      attention_count: 3,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(payload)),
    )
    await expect(
      fetchWorkReportAttentionSummary({
        baseUrl: 'https://api.example.test',
      }),
    ).resolves.toEqual(payload)
  })

  it('rejects inconsistent attention counts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          continued_count: 2,
          follow_up_count: 1,
          attention_count: 4,
        }),
      ),
    )
    await expect(
      fetchWorkReportAttentionSummary({
        baseUrl: 'https://api.example.test',
      }),
    ).rejects.toThrow(WorkReportApiError)
  })
})

describe('updateWorkReport', () => {
  it('patches the same seven-field request shape', async () => {
    const updated = {
      ...responsePayload,
      phenomenon: '安全カバーが扱いにくい',
      cause: '取っ手が小さい',
      progress: 'continued',
    }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(updated))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      updateWorkReport(
        responsePayload.id,
        {
          ...confirmation,
          phenomenon: ' 安全カバーが扱いにくい ',
          cause: ' 取っ手が小さい ',
          progress: 'continued',
        },
        { baseUrl: 'https://api.example.test/' },
      ),
    ).resolves.toEqual(updated)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/work-reports/${responsePayload.id}`,
      expect.objectContaining({ method: 'PATCH' }),
    )
  })
})

it('sends the source inspection only when supplied and exposes duplicate conflicts', async () => {
  const sourceInspectionId = '50000000-0000-4000-8000-000000000001'
  const fetchMock = vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      jsonResponse(
        { ...responsePayload, source_inspection_id: sourceInspectionId },
        201,
      ),
    )
  vi.stubGlobal('fetch', fetchMock)
  const saved = await createWorkReport({ ...confirmation, sourceInspectionId })
  expect(saved.source_inspection_id).toBe(sourceInspectionId)
  expect(
    JSON.parse(String(fetchMock.mock.calls[0][1]?.body)).source_inspection_id,
  ).toBe(sourceInspectionId)
  fetchMock.mockResolvedValue(jsonResponse({ detail: 'Already linked' }, 409))
  await expect(
    createWorkReport({ ...confirmation, sourceInspectionId }),
  ).rejects.toMatchObject({ status: 409 })
})
