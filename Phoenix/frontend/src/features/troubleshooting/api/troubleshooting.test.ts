import { afterEach, describe, expect, it, vi } from 'vitest'

import type {
  TroubleshootingGuide,
  TroubleshootingGuideCreateInput,
} from '../types'
import {
  createTroubleshootingGuide,
  fetchTroubleshootingGuide,
  fetchTroubleshootingGuideCatalog,
  fetchTroubleshootingGuides,
  TroubleshootingApiError,
} from './troubleshooting'

const equipmentId = '30000000-0000-4000-8000-000000000001'
const guideId = '70000000-0000-4000-8000-000000000001'
const questionId = '71000000-0000-4000-8000-000000000001'
const completeId = '71000000-0000-4000-8000-000000000002'
const handoffId = '71000000-0000-4000-8000-000000000003'

const summary = {
  id: guideId,
  equipment_id: equipmentId,
  symptom: 'コンベアーが動かない',
  start_step_id: questionId,
  display_order: 10,
  is_active: true,
  created_at: '2026-08-25T01:00:00+00:00',
  updated_at: '2026-08-25T01:00:00+00:00',
}

const guide = {
  ...summary,
  steps: [
    {
      step_id: questionId,
      step_type: 'question',
      prompt: '運転スイッチは入っていますか？',
      check_method: '操作盤の外側から表示を確認する',
      caution_note: '盤を開けない',
    },
    {
      step_id: completeId,
      step_type: 'complete',
      prompt: '運転担当者へ状態を共有してください。',
      check_method: null,
      caution_note: null,
    },
    {
      step_id: handoffId,
      step_type: 'handoff',
      prompt: '経験者へ引き継いでください。',
      check_method: null,
      caution_note: '会社の安全手順を優先する',
    },
  ],
  branches: [
    {
      branch_id: '72000000-0000-4000-8000-000000000001',
      from_step_id: questionId,
      answer: 'yes',
      to_step_id: completeId,
    },
    {
      branch_id: '72000000-0000-4000-8000-000000000002',
      from_step_id: questionId,
      answer: 'no',
      to_step_id: handoffId,
    },
    {
      branch_id: '72000000-0000-4000-8000-000000000003',
      from_step_id: questionId,
      answer: 'unknown',
      to_step_id: handoffId,
    },
  ],
} satisfies TroubleshootingGuide
const createInput: TroubleshootingGuideCreateInput = {
  equipment_id: equipmentId,
  symptom: summary.symptom,
  start_step_id: questionId,
  display_order: 10,
  is_active: true,
  steps: guide.steps.map(
    ({ step_id, step_type, prompt, check_method, caution_note }) => ({
      step_id,
      step_type,
      prompt,
      check_method,
      caution_note,
    }),
  ),
  branches: guide.branches.map(({ from_step_id, answer, to_step_id }) => ({
    from_step_id,
    answer,
    to_step_id,
  })),
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('troubleshooting guide list API', () => {
  it('loads the administrator catalog without an equipment filter', async () => {
    const inactiveSummary = { ...summary, is_active: false }
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          items: [summary, inactiveSummary],
          total: 2,
          limit: 100,
          offset: 0,
        }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchTroubleshootingGuideCatalog({
        baseUrl: 'https://api.example.test/',
      }),
    ).resolves.toEqual({
      items: [summary, inactiveSummary],
      total: 2,
      limit: 100,
      offset: 0,
    })
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/troubleshooting-guides?limit=100&offset=0',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('loads active symptoms for one equipment with runtime validation', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ items: [summary], total: 1, limit: 100, offset: 0 }),
          { status: 200 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchTroubleshootingGuides(equipmentId, {
        baseUrl: 'https://api.example.test/',
        isActive: true,
      }),
    ).resolves.toEqual({ items: [summary], total: 1, limit: 100, offset: 0 })
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/troubleshooting-guides?equipment_id=${equipmentId}&limit=100&offset=0&is_active=true`,
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('rejects invalid equipment IDs, HTTP failures, and malformed lists', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchTroubleshootingGuides('invalid')).rejects.toThrow(
      TroubleshootingApiError,
    )
    expect(fetchMock).not.toHaveBeenCalled()

    fetchMock.mockResolvedValueOnce(new Response('{}', { status: 503 }))
    await expect(fetchTroubleshootingGuides(equipmentId)).rejects.toMatchObject(
      {
        status: 503,
      },
    )

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({ items: [summary], total: 0, limit: 100, offset: 0 }),
        { status: 200 },
      ),
    )
    await expect(fetchTroubleshootingGuides(equipmentId)).rejects.toThrow(
      'invalid list response',
    )

    fetchMock.mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          items: [{ ...summary, is_active: false }],
          total: 1,
          limit: 100,
          offset: 0,
        }),
        { status: 200 },
      ),
    )
    await expect(
      fetchTroubleshootingGuides(equipmentId, { isActive: true }),
    ).rejects.toThrow('invalid list response')
  })
})

describe('troubleshooting guide detail API', () => {
  it('loads one complete safe guide graph', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(guide), { status: 200 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      fetchTroubleshootingGuide(guideId, {
        baseUrl: 'https://api.example.test/',
      }),
    ).resolves.toEqual(guide)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/troubleshooting-guides/${guideId}`,
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('rejects unsafe unknown routes, cycles, and mismatched guide IDs', async () => {
    const unsafeGuide = structuredClone(guide)
    unsafeGuide.branches[2].to_step_id = completeId
    const cyclicGuide = structuredClone(guide)
    cyclicGuide.branches[0].to_step_id = questionId
    const mismatchedGuide = {
      ...guide,
      id: '70000000-0000-4000-8000-000000000099',
    }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(unsafeGuide), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(cyclicGuide), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify(mismatchedGuide), { status: 200 }),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchTroubleshootingGuide(guideId)).rejects.toThrow(
      'invalid guide response',
    )
    await expect(fetchTroubleshootingGuide(guideId)).rejects.toThrow(
      'invalid guide response',
    )
    await expect(fetchTroubleshootingGuide(guideId)).rejects.toThrow(
      'invalid guide response',
    )
  })

  it('rejects invalid IDs before sending a request', async () => {
    const fetchMock = vi.fn<typeof fetch>()
    vi.stubGlobal('fetch', fetchMock)

    await expect(fetchTroubleshootingGuide('invalid')).rejects.toThrow(
      TroubleshootingApiError,
    )
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('troubleshooting guide create API', () => {
  it('posts one complete guide graph and validates the saved response', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(JSON.stringify(guide), { status: 201 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createTroubleshootingGuide(createInput, {
        baseUrl: 'https://api.example.test/',
      }),
    ).resolves.toEqual(guide)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/troubleshooting-guides',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(createInput),
      }),
    )
  })

  it('reports HTTP failures and rejects mismatched saved responses', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response('{}', { status: 422 }))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            ...guide,
            equipment_id: equipmentId.replace(/1$/, '2'),
          }),
          { status: 201 },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    await expect(createTroubleshootingGuide(createInput)).rejects.toMatchObject(
      { status: 422 },
    )
    await expect(createTroubleshootingGuide(createInput)).rejects.toThrow(
      'invalid guide response',
    )
  })
})
