import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { READY_EQUIPMENT_OPTIONS } from '../testFixtures'
import {
  WorkReportGuideHandoffConflict,
  WorkReportPanel,
} from './WorkReportPanel'

describe('WorkReportPanel', () => {
  it('renders exactly the seven normal work-report fields', () => {
    const markup = renderToStaticMarkup(
      <WorkReportPanel
        equipmentOptionsState={READY_EQUIPMENT_OPTIONS}
        onReloadEquipmentOptions={() => undefined}
      />,
    )

    expect(markup).toContain('作業日報')
    expect(markup).toContain('id="work-report-section"')
    for (const id of [
      'work-report-date',
      'work-report-department',
      'work-report-equipment',
      'work-report-phenomenon',
      'work-report-cause',
      'work-report-content',
      'work-report-progress',
    ]) {
      expect(markup).toContain(`id="${id}"`)
    }
    expect(markup).toContain('1. 日付')
    expect(markup).toContain('2. 部門')
    expect(markup).toContain('3. 設備')
    expect(markup).toContain('原因（未特定なら空欄）')
    expect(markup).toContain('入力内容を確認')
    expect(markup).toContain('7項目で記録')
    expect(markup).toContain('入力途中の内容はこの端末に自動保存')
    expect(markup).not.toContain('作業カテゴリ')
    expect(markup).not.toContain('作業時間')
    expect(markup).not.toContain('備考（任意）')
  })

  it('asks before replacing an existing draft with guide content', () => {
    const markup = renderToStaticMarkup(
      <WorkReportGuideHandoffConflict
        request={{
          requestId: 1,
          departmentId: '10000000-0000-4000-8000-000000000001',
          equipmentId: '30000000-0000-4000-8000-000000000001',
          phenomenon: 'コンベアーが動かない',
        }}
        onKeepDraft={() => undefined}
        onReplaceDraft={() => undefined}
      />,
    )

    expect(markup).toContain('入力途中の下書きがあります')
    expect(markup).toContain('コンベアーが動かない')
    expect(markup).toContain('現在の下書きを維持')
    expect(markup).toContain('下書きを破棄してガイド内容を反映')
  })
})
