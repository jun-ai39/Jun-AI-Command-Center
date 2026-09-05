import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  fetchInspectionStatus,
  InspectionStatusApiError,
} from './inspectionStatus'

afterEach(() => {
  vi.unstubAllGlobals()
})

const validResponse = {
  target_date: '2026-08-21',
  cycle_summaries: [
    { cycle: 'daily', total: 1, completed: 1, pending: 0 },
    { cycle: 'weekly', total: 1, completed: 0, pending: 1 },
    { cycle: 'monthly', total: 0, completed: 0, pending: 0 },
  ],
  items: [
    {
      equipment_id: '30000000-0000-4000-8000-000000000001',
      equipment_name: '包装機',
      equipment_number: 'No.2',
      department_id: '10000000-0000-4000-8000-000000000001',
      department_name: '菓子パン',
      cycle: 'daily',
      period_key: '2026-08-21',
      template_item_count: 2,
      completion_status: 'completed',
      inspection_record_id: '50000000-0000-4000-8000-000000000001',
      inspection_date: '2026-08-21',
      overall_judgment: 'normal',
    },
    {
      equipment_id: '30000000-0000-4000-8000-000000000002',
      equipment_name: 'ミキサー',
      equipment_number: 'M-1',
      department_id: '10000000-0000-4000-8000-000000000002',
      department_name: '食パン',
      cycle: 'weekly',
      period_key: '2026-W34',
      template_item_count: 1,
      completion_status: 'pending',
      inspection_record_id: null,
      inspection_date: null,
      overall_judgment: null,
    },
  ],
}

describe('inspection status API', () => {
  it('loads a validated status summary for the browser local date', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(validResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchInspectionStatus('2026-08-21', {
        baseUrl: 'https://api.example.test/',
      }),
    ).resolves.toEqual(validResponse)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/inspection-status?target_date=2026-08-21',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('rejects inconsistent cycle counts', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            ...validResponse,
            cycle_summaries: [
              { cycle: 'daily', total: 2, completed: 1, pending: 1 },
              ...validResponse.cycle_summaries.slice(1),
            ],
          }),
          { status: 200 },
        ),
      ),
    )

    await expect(fetchInspectionStatus('2026-08-21')).rejects.toThrow(
      InspectionStatusApiError,
    )
  })

  it('rejects a period key that does not match the target date', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            ...validResponse,
            items: [
              validResponse.items[0],
              { ...validResponse.items[1], period_key: '2026-W33' },
            ],
          }),
          { status: 200 },
        ),
      ),
    )

    await expect(fetchInspectionStatus('2026-08-21')).rejects.toThrow(
      InspectionStatusApiError,
    )
  })

  it('rejects an invalid date before sending a request', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchInspectionStatus('2026-02-30')).rejects.toThrow(
      InspectionStatusApiError,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})
