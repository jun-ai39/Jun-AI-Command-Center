import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createEquipmentChangeHistory,
  EquipmentChangeHistoryApiError,
  fetchEquipmentChangeHistories,
} from './equipmentChangeHistories'

afterEach(() => {
  vi.unstubAllGlobals()
})

const equipmentId = '30000000-0000-4000-8000-000000000001'
const history = {
  change_history_id: '80000000-0000-4000-8000-000000000001',
  equipment_id: equipmentId,
  changed_on: '2026-08-26',
  improvement_point: 'チェーンガイドの搬送安定化',
  change_details: '架空の樹脂ガイド形状を変更し、蛇行しにくい構造にした。',
  work_report_id: '90000000-0000-4000-8000-000000000001',
  created_at: '2026-08-26T01:00:00+00:00',
  updated_at: '2026-08-26T01:00:00+00:00',
}
const createInput = {
  equipmentId,
  changedOn: '2026-08-26',
  improvementPoint: '  チェーンガイドの搬送安定化  ',
  changeDetails: '  架空の樹脂ガイド形状を変更し、蛇行しにくい構造にした。  ',
  workReportId: history.work_report_id,
}

function jsonResponse(payload: unknown, status = 200): Response {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })
}

describe('equipment change history API', () => {
  it('saves normalized change details and an optional related report', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(history, 201))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createEquipmentChangeHistory(createInput, {
        baseUrl: 'https://api.example.test/',
      }),
    ).resolves.toEqual(history)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/equipment-change-histories',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          equipment_id: equipmentId,
          changed_on: '2026-08-26',
          improvement_point: 'チェーンガイドの搬送安定化',
          change_details:
            '架空の樹脂ガイド形状を変更し、蛇行しにくい構造にした。',
          work_report_id: history.work_report_id,
        }),
      }),
    )
  })

  it('saves an independent history without a work report', async () => {
    const independent = { ...history, work_report_id: null }
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(independent, 201)),
    )

    await expect(
      createEquipmentChangeHistory(
        { ...createInput, workReportId: null },
        { baseUrl: 'https://api.example.test' },
      ),
    ).resolves.toEqual(independent)
  })

  it('rejects invalid create input before requesting', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createEquipmentChangeHistory({
        ...createInput,
        changedOn: '2026-02-30',
      }),
    ).rejects.toThrow(EquipmentChangeHistoryApiError)
    await expect(
      createEquipmentChangeHistory({
        ...createInput,
        improvementPoint: ' ',
      }),
    ).rejects.toThrow(EquipmentChangeHistoryApiError)
    await expect(
      createEquipmentChangeHistory({
        ...createInput,
        workReportId: 'invalid',
      }),
    ).rejects.toThrow(EquipmentChangeHistoryApiError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects mismatched create responses and keeps HTTP failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse(
          {
            ...history,
            equipment_id: '30000000-0000-4000-8000-000000000002',
          },
          201,
        ),
      ),
    )
    await expect(
      createEquipmentChangeHistory(createInput, {
        baseUrl: 'https://api.example.test',
      }),
    ).rejects.toThrow(EquipmentChangeHistoryApiError)

    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 422 })),
    )
    await expect(
      createEquipmentChangeHistory(createInput, {
        baseUrl: 'https://api.example.test',
      }),
    ).rejects.toMatchObject({ status: 422 })
  })

  it('loads the newest equipment-specific histories with page metadata', async () => {
    const payload = { items: [history], total: 3, limit: 5, offset: 0 }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(jsonResponse(payload))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchEquipmentChangeHistories({
        equipmentId,
        baseUrl: 'https://api.example.test/',
      }),
    ).resolves.toEqual(payload)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/equipment-change-histories?equipment_id=${equipmentId}&limit=5&offset=0`,
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('accepts an independent history without a related work report', async () => {
    const payload = {
      items: [{ ...history, work_report_id: null }],
      total: 1,
      limit: 5,
      offset: 0,
    }
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(jsonResponse(payload)),
    )

    await expect(
      fetchEquipmentChangeHistories({
        equipmentId,
        baseUrl: 'https://api.example.test',
      }),
    ).resolves.toEqual(payload)
  })

  it('rejects invalid equipment and page parameters before requesting', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchEquipmentChangeHistories({ equipmentId: 'invalid' }),
    ).rejects.toThrow(EquipmentChangeHistoryApiError)
    await expect(
      fetchEquipmentChangeHistories({ equipmentId, limit: 51 }),
    ).rejects.toThrow(EquipmentChangeHistoryApiError)
    await expect(
      fetchEquipmentChangeHistories({ equipmentId, offset: -1 }),
    ).rejects.toThrow(EquipmentChangeHistoryApiError)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('rejects malformed or cross-equipment response data', async () => {
    const otherEquipmentId = '30000000-0000-4000-8000-000000000002'
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          items: [{ ...history, equipment_id: otherEquipmentId }],
          total: 1,
          limit: 5,
          offset: 0,
        }),
      ),
    )
    await expect(
      fetchEquipmentChangeHistories({
        equipmentId,
        baseUrl: 'https://api.example.test',
      }),
    ).rejects.toThrow(EquipmentChangeHistoryApiError)

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        jsonResponse({
          items: [{ ...history, changed_on: '2026-02-30' }],
          total: 1,
          limit: 5,
          offset: 0,
        }),
      ),
    )
    await expect(
      fetchEquipmentChangeHistories({
        equipmentId,
        baseUrl: 'https://api.example.test',
      }),
    ).rejects.toThrow(EquipmentChangeHistoryApiError)
  })

  it('keeps the HTTP status when loading fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 503 })),
    )

    await expect(
      fetchEquipmentChangeHistories({
        equipmentId,
        baseUrl: 'https://api.example.test',
      }),
    ).rejects.toMatchObject({ status: 503 })
  })
})
