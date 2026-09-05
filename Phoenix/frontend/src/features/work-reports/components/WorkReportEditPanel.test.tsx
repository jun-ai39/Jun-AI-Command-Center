import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { WorkReport } from '../types'
import {
  READY_EQUIPMENT_OPTIONS,
  TEST_DEPARTMENT_ID,
  TEST_EQUIPMENT_ID,
} from '../testFixtures'
import { WorkReportEditPanel } from './WorkReportEditPanel'

const report: WorkReport = {
  id: '9b73f331-d416-41c8-b5e2-6f3e53b7ac31',
  work_date: '2026-08-21',
  department_id: TEST_DEPARTMENT_ID,
  equipment_id: TEST_EQUIPMENT_ID,
  department_name: '菓子パン',
  equipment_name: '包装機',
  equipment_number: 'No.2',
  phenomenon: '搬送部から異音',
  cause: 'ベルト張力の低下',
  work_content: '架空設備のベルト張力を調整',
  progress: 'completed',
  is_legacy: false,
  legacy_category: null,
  legacy_work_hours: null,
  legacy_notes: null,
  created_at: '2026-08-21T01:00:00+00:00',
  updated_at: '2026-08-21T01:00:00+00:00',
}

describe('WorkReportEditPanel', () => {
  it('prefills all seven fields and keeps normal editing simple', () => {
    const markup = renderToStaticMarkup(
      <WorkReportEditPanel
        report={report}
        onCancel={vi.fn()}
        onUpdated={vi.fn()}
        equipmentOptionsState={READY_EQUIPMENT_OPTIONS}
        onReloadEquipmentOptions={vi.fn()}
      />,
    )

    expect(markup).toContain('保存済み日報を編集')
    expect(markup).toContain('value="2026-08-21"')
    expect(markup).toContain('搬送部から異音')
    expect(markup).toContain('ベルト張力の低下')
    expect(markup).toContain('架空設備のベルト張力を調整')
    expect(markup).toContain('value="completed" selected=""')
    expect(markup).toContain('変更内容を確認')
    expect(markup).not.toContain('旧形式の日報です')
  })

  it('explains that legacy details remain when converting an old report', () => {
    const markup = renderToStaticMarkup(
      <WorkReportEditPanel
        report={{
          ...report,
          phenomenon: null,
          cause: null,
          is_legacy: true,
          legacy_category: 'maintenance',
          legacy_work_hours: 1.5,
          legacy_notes: '旧備考',
        }}
        onCancel={vi.fn()}
        onUpdated={vi.fn()}
        equipmentOptionsState={READY_EQUIPMENT_OPTIONS}
        onReloadEquipmentOptions={vi.fn()}
      />,
    )
    expect(markup).toContain('旧形式の日報です')
    expect(markup).toContain('旧カテゴリ・作業時間・備考は保持')
  })
})
