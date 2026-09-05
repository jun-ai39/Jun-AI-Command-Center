import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { InspectionStatusState } from '../types'
import { InspectionStatusContent } from './InspectionStatusPanel'

const readyState: InspectionStatusState = {
  phase: 'ready',
  data: {
    target_date: '2026-08-21',
    cycle_summaries: [
      { cycle: 'daily', total: 2, completed: 1, pending: 1 },
      { cycle: 'weekly', total: 1, completed: 1, pending: 0 },
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
        cycle: 'daily',
        period_key: '2026-08-21',
        template_item_count: 1,
        completion_status: 'pending',
        inspection_record_id: null,
        inspection_date: null,
        overall_judgment: null,
      },
      {
        equipment_id: '30000000-0000-4000-8000-000000000003',
        equipment_name: '搬送コンベア',
        equipment_number: 'CV-3',
        department_id: '10000000-0000-4000-8000-000000000003',
        department_name: '物流',
        cycle: 'weekly',
        period_key: '2026-W34',
        template_item_count: 3,
        completion_status: 'completed',
        inspection_record_id: '50000000-0000-4000-8000-000000000002',
        inspection_date: '2026-08-18',
        overall_judgment: 'abnormal',
      },
    ],
  },
}

describe('InspectionStatusContent', () => {
  it('shows cycle totals and equipment-level completion states', () => {
    const markup = renderToStaticMarkup(
      <InspectionStatusContent
        targetDate="2026-08-21"
        state={readyState}
        onReload={vi.fn()}
        onStartInspection={vi.fn()}
      />,
    )

    expect(markup).toContain('MANAGE / STEP 100')
    expect(markup).toContain('定期点検')
    expect(markup).toContain('2026年8月21日時点')
    expect(markup).toContain('未実施 1件')
    expect(markup).toContain('毎日点検')
    expect(markup).toContain('毎週点検')
    expect(markup).toContain('毎月点検')
    expect(markup).toContain('包装機 No.2')
    expect(markup).toContain('実施済み・正常')
    expect(markup).toContain('ミキサー M-1')
    expect(markup).toContain('未実施')
    expect(markup).toContain('搬送コンベア CV-3')
    expect(markup).toContain('実施済み・異常')
    expect(markup).toContain('この点検を入力')
    expect(markup).toContain('aria-label="ミキサー M-1の毎日点検を入力"')
    expect(markup.match(/この点検を入力/g)).toHaveLength(1)
  })

  it('shows loading and recoverable error states', () => {
    const loadingMarkup = renderToStaticMarkup(
      <InspectionStatusContent
        targetDate="2026-08-21"
        state={{ phase: 'loading' }}
        onReload={vi.fn()}
        onStartInspection={vi.fn()}
      />,
    )
    const errorMarkup = renderToStaticMarkup(
      <InspectionStatusContent
        targetDate="2026-08-21"
        state={{ phase: 'error' }}
        onReload={vi.fn()}
        onStartInspection={vi.fn()}
      />,
    )

    expect(loadingMarkup).toContain('定期点検の実施状況を読み込んでいます')
    expect(errorMarkup).toContain('定期点検の実施状況を読み込めませんでした')
    expect(errorMarkup).toContain('もう一度読み込む')
  })

  it('shows an explicit empty configuration state', () => {
    const markup = renderToStaticMarkup(
      <InspectionStatusContent
        targetDate="2026-08-21"
        state={{
          phase: 'ready',
          data: {
            target_date: '2026-08-21',
            cycle_summaries: [
              { cycle: 'daily', total: 0, completed: 0, pending: 0 },
              { cycle: 'weekly', total: 0, completed: 0, pending: 0 },
              { cycle: 'monthly', total: 0, completed: 0, pending: 0 },
            ],
            items: [],
          },
        }}
        onReload={vi.fn()}
        onStartInspection={vi.fn()}
      />,
    )

    expect(markup).toContain('未実施なし')
    expect(markup).toContain('点検項目が設定された使用中設備はまだありません')
    expect(markup).not.toContain('この点検を入力')
  })
})
