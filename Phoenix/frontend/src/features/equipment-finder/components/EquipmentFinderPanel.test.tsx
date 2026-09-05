import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { EquipmentFinderState } from '../types'
import { EquipmentFinderContent } from './EquipmentFinderPanel'

const timestamp = '2026-08-22T01:00:00+00:00'
const readyState: EquipmentFinderState = {
  phase: 'ready',
  data: {
    departments: [
      {
        id: '10000000-0000-4000-8000-000000000001',
        name: '菓子パン',
        display_order: 10,
        is_active: true,
        created_at: timestamp,
        updated_at: timestamp,
      },
    ],
    manufacturers: [
      {
        id: '20000000-0000-4000-8000-000000000001',
        name: '架空Aメーカー',
        is_active: true,
        created_at: timestamp,
        updated_at: timestamp,
      },
    ],
    equipment: [
      {
        equipment_id: '30000000-0000-4000-8000-000000000001',
        department_id: '10000000-0000-4000-8000-000000000001',
        manufacturer_id: '20000000-0000-4000-8000-000000000001',
        name: '包装機',
        equipment_number: 'No.2',
        model_number: 'TEST-200',
        photo_path: null,
        is_active: true,
        created_at: timestamp,
        updated_at: timestamp,
      },
    ],
  },
}

describe('EquipmentFinderContent', () => {
  it('shows the user-facing tree and keyword search without admin forms', () => {
    const markup = renderToStaticMarkup(
      <EquipmentFinderContent
        state={readyState}
        onReload={vi.fn()}
        onStartWorkReport={vi.fn()}
      />,
    )

    expect(markup).toContain('KNOWLEDGE / STEP 99')
    expect(markup).toContain('設備を探す')
    expect(markup).toContain('部門 → メーカー → 設備')
    expect(markup).toContain('id="equipment-finder-keyword"')
    expect(markup).toContain('菓子パン')
    expect(markup).toContain('架空Aメーカー')
    expect(markup).toContain('包装機 No.2')
    expect(markup).toContain('TEST-200')
    expect(markup).toContain('設備カルテを開く')
    expect(markup).not.toContain('メーカーを登録')
    expect(markup).not.toContain('設備を登録')
    expect(markup).not.toContain('固有設備ID')
  })

  it('shows loading and failure recovery states', () => {
    const loadingMarkup = renderToStaticMarkup(
      <EquipmentFinderContent
        state={{ phase: 'loading' }}
        onReload={vi.fn()}
        onStartWorkReport={vi.fn()}
      />,
    )
    const errorMarkup = renderToStaticMarkup(
      <EquipmentFinderContent
        state={{ phase: 'error' }}
        onReload={vi.fn()}
        onStartWorkReport={vi.fn()}
      />,
    )

    expect(loadingMarkup).toContain('設備を読み込んでいます')
    expect(errorMarkup).toContain('設備を読み込めませんでした')
    expect(errorMarkup).toContain('もう一度読み込む')
  })

  it('shows an explicit empty state', () => {
    const markup = renderToStaticMarkup(
      <EquipmentFinderContent
        state={{
          phase: 'ready',
          data: { ...readyState.data, equipment: [] },
        }}
        onReload={vi.fn()}
        onStartWorkReport={vi.fn()}
      />,
    )

    expect(markup).toContain('使用中の設備はまだ登録されていません')
  })
})
