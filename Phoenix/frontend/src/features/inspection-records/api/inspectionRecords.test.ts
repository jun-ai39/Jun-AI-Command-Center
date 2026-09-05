import { afterEach, describe, expect, it, vi } from 'vitest'

import type { InspectionRecordCreateInput } from '../types'
import {
  createInspectionRecord,
  fetchInspectionRecords,
  InspectionRecordApiError,
} from './inspectionRecords'

afterEach(() => {
  vi.unstubAllGlobals()
})

const equipmentId = '30000000-0000-4000-8000-000000000002'
const numberTemplateId = '40000000-0000-4000-8000-000000000001'
const statusTemplateId = '40000000-0000-4000-8000-000000000002'
const input: InspectionRecordCreateInput = {
  inspectionDate: '2026-08-21',
  equipmentId,
  cycle: 'daily',
  items: [
    {
      templateItemId: numberTemplateId,
      numberValue: 12.4,
      statusValue: null,
    },
    {
      templateItemId: statusTemplateId,
      numberValue: null,
      statusValue: 'abnormal',
    },
  ],
}
const response = {
  id: '50000000-0000-4000-8000-000000000001',
  inspection_date: '2026-08-21',
  equipment_id: equipmentId,
  equipment_name: '包装機',
  equipment_number: 'No.2',
  cycle: 'daily',
  period_key: '2026-08-21',
  overall_judgment: 'abnormal',
  items: [
    {
      id: '60000000-0000-4000-8000-000000000001',
      template_item_id: numberTemplateId,
      name: 'モーター電流',
      input_type: 'number',
      number_value: 12.4,
      status_value: null,
      unit: 'A',
      normal_min: 10,
      normal_max: 15,
      normal_state: null,
      judgment: 'normal',
      display_order: 10,
    },
    {
      id: '60000000-0000-4000-8000-000000000002',
      template_item_id: statusTemplateId,
      name: 'ベルト状態',
      input_type: 'status',
      number_value: null,
      status_value: 'abnormal',
      unit: null,
      normal_min: null,
      normal_max: null,
      normal_state: '亀裂・緩みなし',
      judgment: 'abnormal',
      display_order: 20,
    },
  ],
  created_at: '2026-08-21T01:00:00+00:00',
  updated_at: '2026-08-21T01:00:00+00:00',
}

describe('inspection record API', () => {
  it('loads one equipment inspection history with page metadata', async () => {
    const listResponse = {
      items: [response],
      total: 3,
      limit: 5,
      offset: 0,
    }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify(listResponse), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchInspectionRecords({
        equipmentId,
        baseUrl: 'https://api.example.test/',
      }),
    ).resolves.toEqual(listResponse)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/inspection-records?equipment_id=${equipmentId}&limit=5&offset=0`,
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('rejects invalid inspection history metadata and request filters', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ items: [response], total: 0, limit: 5, offset: 0 }),
          { status: 200 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchInspectionRecords({
        equipmentId,
        baseUrl: 'https://api.example.test',
      }),
    ).rejects.toThrow(InspectionRecordApiError)
    await expect(
      fetchInspectionRecords({ equipmentId: 'invalid' }),
    ).rejects.toThrow(InspectionRecordApiError)
    await expect(
      fetchInspectionRecords({ equipmentId, limit: 51 }),
    ).rejects.toThrow(InspectionRecordApiError)
  })

  it('saves all structured values and validates the returned judgments', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify(response), { status: 201 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createInspectionRecord(input, {
        baseUrl: 'https://api.example.test/',
      }),
    ).resolves.toEqual(response)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/inspection-records',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          inspection_date: '2026-08-21',
          equipment_id: equipmentId,
          cycle: 'daily',
          items: [
            {
              template_item_id: numberTemplateId,
              number_value: 12.4,
              status_value: null,
            },
            {
              template_item_id: statusTemplateId,
              number_value: null,
              status_value: 'abnormal',
            },
          ],
        }),
      }),
    )
  })

  it('rejects a response whose judgments contradict the saved values', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            ...response,
            items: [
              { ...response.items[0], judgment: 'abnormal' },
              response.items[1],
            ],
          }),
          { status: 201 },
        ),
      ),
    )

    await expect(
      createInspectionRecord(input, {
        baseUrl: 'https://api.example.test',
      }),
    ).rejects.toThrow(InspectionRecordApiError)
  })

  it('keeps the HTTP status for duplicate-period handling', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response('{}', { status: 409 })),
    )

    await expect(
      createInspectionRecord(input, {
        baseUrl: 'https://api.example.test',
      }),
    ).rejects.toMatchObject({ status: 409 })
  })

  it('rejects invalid dates before sending a request', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createInspectionRecord({ ...input, inspectionDate: '2026-02-30' }),
    ).rejects.toThrow(InspectionRecordApiError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
