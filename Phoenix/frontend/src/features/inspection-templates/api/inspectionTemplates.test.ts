import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createInspectionTemplateItem,
  fetchInspectionTemplateItems,
  InspectionTemplateApiError,
  updateInspectionTemplateGuide,
} from './inspectionTemplates'

afterEach(() => {
  vi.unstubAllGlobals()
})

const timestamp = '2026-08-21T01:00:00+00:00'
const equipmentId = '30000000-0000-4000-8000-000000000002'
const numberItem = {
  id: '40000000-0000-4000-8000-000000000001',
  equipment_id: equipmentId,
  cycle: 'daily',
  name: 'モーター電流',
  input_type: 'number',
  unit: 'A',
  normal_min: 10,
  normal_max: 15,
  normal_state: null,
  check_method: '操作盤の電流表示を運転中に確認する',
  caution_note: '回転部へ手を近づけない',
  display_order: 10,
  is_active: true,
  created_at: timestamp,
  updated_at: timestamp,
}
const statusItem = {
  ...numberItem,
  id: '40000000-0000-4000-8000-000000000002',
  cycle: 'weekly',
  name: 'ベルト状態',
  input_type: 'status',
  unit: null,
  normal_min: null,
  normal_max: null,
  normal_state: '亀裂・緩みなし',
  check_method: null,
  caution_note: null,
  display_order: 20,
}

describe('inspection template list API', () => {
  it('loads one equipment inspection item master', async () => {
    const response = {
      items: [numberItem, statusItem],
      total: 2,
      limit: 100,
      offset: 0,
    }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify(response), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchInspectionTemplateItems(equipmentId, {
        baseUrl: 'https://api.example.test/',
      }),
    ).resolves.toEqual(response)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/inspection-template-items?equipment_id=${equipmentId}&limit=100&offset=0`,
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('loads only active items for one inspection cycle', async () => {
    const response = {
      items: [numberItem],
      total: 1,
      limit: 100,
      offset: 0,
    }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify(response), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await fetchInspectionTemplateItems(equipmentId, {
      baseUrl: 'https://api.example.test',
      cycle: 'daily',
      isActive: true,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/inspection-template-items?equipment_id=${equipmentId}&limit=100&offset=0&cycle=daily&is_active=true`,
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('rejects invalid equipment identifiers and invalid payloads', async () => {
    await expect(
      fetchInspectionTemplateItems('invalid', {
        baseUrl: 'https://api.example.test',
      }),
    ).rejects.toThrow(InspectionTemplateApiError)

    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [{ ...numberItem, normal_min: 20, normal_max: 10 }],
            total: 1,
            limit: 100,
            offset: 0,
          }),
          { status: 200 },
        ),
      ),
    )
    await expect(
      fetchInspectionTemplateItems(equipmentId, {
        baseUrl: 'https://api.example.test',
      }),
    ).rejects.toThrow(InspectionTemplateApiError)
  })
})

describe('inspection template create API', () => {
  it('normalizes and saves a numeric inspection item', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify(numberItem), { status: 201 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createInspectionTemplateItem(
        {
          equipmentId,
          cycle: 'daily',
          name: '  モーター電流  ',
          inputType: 'number',
          unit: '  A  ',
          normalMin: 10,
          normalMax: 15,
          normalState: '',
          checkMethod: '  操作盤の電流表示を運転中に確認する  ',
          cautionNote: '  回転部へ手を近づけない  ',
          displayOrder: 10,
          isActive: true,
        },
        { baseUrl: 'https://api.example.test/' },
      ),
    ).resolves.toEqual(numberItem)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/inspection-template-items',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({
          equipment_id: equipmentId,
          cycle: 'daily',
          name: 'モーター電流',
          input_type: 'number',
          unit: 'A',
          normal_min: 10,
          normal_max: 15,
          normal_state: null,
          check_method: '操作盤の電流表示を運転中に確認する',
          caution_note: '回転部へ手を近づけない',
          display_order: 10,
          is_active: true,
        }),
      }),
    )
  })

  it('removes numeric fields when saving a status inspection item', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify(statusItem), { status: 201 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await createInspectionTemplateItem(
      {
        equipmentId,
        cycle: 'weekly',
        name: 'ベルト状態',
        inputType: 'status',
        unit: 'A',
        normalMin: 10,
        normalMax: 15,
        normalState: '  亀裂・緩みなし  ',
        checkMethod: '',
        cautionNote: '',
        displayOrder: 20,
        isActive: false,
      },
      { baseUrl: 'https://api.example.test' },
    )
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/inspection-template-items',
      expect.objectContaining({
        body: JSON.stringify({
          equipment_id: equipmentId,
          cycle: 'weekly',
          name: 'ベルト状態',
          input_type: 'status',
          unit: null,
          normal_min: null,
          normal_max: null,
          normal_state: '亀裂・緩みなし',
          check_method: null,
          caution_note: null,
          display_order: 20,
          is_active: false,
        }),
      }),
    )
  })
})

describe('inspection template guide update API', () => {
  it('trims and updates only the inspection guide fields', async () => {
    const updatedItem = {
      ...numberItem,
      check_method: '停止後に保護カバー越しで摩耗を確認する',
      caution_note: 'カバーを外す場合は教育済み作業者へ引き継ぐ',
    }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify(updatedItem), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      updateInspectionTemplateGuide(
        {
          itemId: numberItem.id,
          checkMethod: '  停止後に保護カバー越しで摩耗を確認する  ',
          cautionNote: '  カバーを外す場合は教育済み作業者へ引き継ぐ  ',
        },
        { baseUrl: 'https://api.example.test/' },
      ),
    ).resolves.toEqual(updatedItem)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/inspection-template-items/${numberItem.id}/guide`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({
          check_method: '停止後に保護カバー越しで摩耗を確認する',
          caution_note: 'カバーを外す場合は教育済み作業者へ引き継ぐ',
        }),
      }),
    )
  })

  it('clears blank guide fields and rejects invalid item identifiers', async () => {
    const clearedItem = {
      ...numberItem,
      check_method: null,
      caution_note: null,
    }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(JSON.stringify(clearedItem), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await updateInspectionTemplateGuide(
      {
        itemId: numberItem.id,
        checkMethod: '  ',
        cautionNote: '',
      },
      { baseUrl: 'https://api.example.test' },
    )
    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          check_method: null,
          caution_note: null,
        }),
      }),
    )

    await expect(
      updateInspectionTemplateGuide({
        itemId: 'invalid',
        checkMethod: '',
        cautionNote: '',
      }),
    ).rejects.toThrow(InspectionTemplateApiError)
  })
})
