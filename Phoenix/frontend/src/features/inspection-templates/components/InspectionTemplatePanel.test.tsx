import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { Equipment } from '../../equipment-master/types'
import type { InspectionTemplateItem } from '../types'
import {
  InspectionTemplatePanel,
  InspectionTemplateWorkspaceContent,
} from './InspectionTemplatePanel'
import { InspectionTemplateGuideEditor } from './InspectionTemplateList'

const equipment: Equipment = {
  equipment_id: '30000000-0000-4000-8000-000000000002',
  department_id: '10000000-0000-4000-8000-000000000001',
  manufacturer_id: '20000000-0000-4000-8000-000000000001',
  name: '包装機',
  equipment_number: 'No.2',
  model_number: 'TEST-200',
  photo_path: null,
  is_active: true,
  created_at: '2026-08-21T01:00:00+00:00',
  updated_at: '2026-08-21T01:00:00+00:00',
}

const numberItem: InspectionTemplateItem = {
  id: '40000000-0000-4000-8000-000000000001',
  equipment_id: equipment.equipment_id,
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
  created_at: '2026-08-21T01:00:00+00:00',
  updated_at: '2026-08-21T01:00:00+00:00',
}

const statusItem: InspectionTemplateItem = {
  ...numberItem,
  id: '40000000-0000-4000-8000-000000000002',
  cycle: 'weekly',
  name: 'ベルト状態',
  input_type: 'status',
  unit: null,
  normal_min: null,
  normal_max: null,
  normal_state: '亀裂・緩みなし',
  check_method: '停止状態でベルト表面を目視する',
  caution_note: '会社の停止手順を優先する',
  display_order: 20,
  is_active: false,
}

const baseProps = {
  equipment,
  saveState: { phase: 'idle' } as const,
  guideSaveState: { phase: 'idle' } as const,
  onSave: vi.fn(async () => null),
  onSaveGuide: vi.fn(async () => null),
  onResetSave: vi.fn(),
  onResetGuideSave: vi.fn(),
  onReload: vi.fn(),
}

describe('InspectionTemplatePanel', () => {
  it('shows the selected equipment form and structured item list', () => {
    const markup = renderToStaticMarkup(
      <InspectionTemplateWorkspaceContent
        {...baseProps}
        state={{
          phase: 'ready',
          items: [numberItem, statusItem],
          total: 2,
        }}
      />,
    )

    expect(markup).toContain('包装機 No.2専用')
    expect(markup).toContain('id="inspection-template-cycle"')
    expect(markup).toContain('id="inspection-template-input-type"')
    expect(markup).toContain('id="inspection-template-name"')
    expect(markup).toContain('id="inspection-template-normal-min"')
    expect(markup).toContain('id="inspection-template-check-method"')
    expect(markup).toContain('id="inspection-template-caution-note"')
    expect(markup).toContain('モーター電流')
    expect(markup).toContain('10 ～ 15 A')
    expect(markup).toContain('ベルト状態')
    expect(markup).toContain('亀裂・緩みなし')
    expect(markup).toContain('停止状態でベルト表面を目視する')
    expect(markup).toContain('会社の停止手順を優先する')
    expect(markup).toContain('使用停止')
    expect(markup).toContain('登録2件／表示2件')
  })

  it('shows loading, empty, and recoverable error states', () => {
    const loadingMarkup = renderToStaticMarkup(
      <InspectionTemplateWorkspaceContent
        {...baseProps}
        state={{ phase: 'loading' }}
      />,
    )
    const emptyMarkup = renderToStaticMarkup(
      <InspectionTemplateWorkspaceContent
        {...baseProps}
        state={{ phase: 'ready', items: [], total: 0 }}
      />,
    )
    const errorMarkup = renderToStaticMarkup(
      <InspectionTemplateWorkspaceContent
        {...baseProps}
        state={{ phase: 'error' }}
      />,
    )

    expect(loadingMarkup).toContain('点検項目を読み込んでいます')
    expect(emptyMarkup).toContain('点検項目はまだ登録されていません')
    expect(errorMarkup).toContain('点検項目を読み込めませんでした')
    expect(errorMarkup).toContain('もう一度読み込む')
  })

  it('asks for an active equipment before configuration', () => {
    const markup = renderToStaticMarkup(
      <InspectionTemplatePanel equipment={[]} />,
    )

    expect(markup).toContain('INSPECTION MASTER / STEP 96')
    expect(markup).toContain('設備別点検項目マスター')
    expect(markup).toContain('使用中の設備を1件登録してください')
  })

  it('shows a guide-only editor with current values and save controls', () => {
    const markup = renderToStaticMarkup(
      <InspectionTemplateGuideEditor
        item={numberItem}
        saveState={{ phase: 'idle' }}
        onSave={vi.fn(async () => null)}
        onResetSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(markup).toContain('確認方法')
    expect(markup).toContain('操作盤の電流表示を運転中に確認する')
    expect(markup).toContain('注意事項・引継ぎ条件')
    expect(markup).toContain('回転部へ手を近づけない')
    expect(markup).toContain('キャンセル')
    expect(markup).toContain('ガイドを保存')
    expect(markup).not.toContain('正常範囲')
  })

  it('shows the guide save success state for the edited item', () => {
    const markup = renderToStaticMarkup(
      <InspectionTemplateGuideEditor
        item={numberItem}
        saveState={{ phase: 'saved', item: numberItem }}
        onSave={vi.fn(async () => null)}
        onResetSave={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(markup).toContain('ガイドを保存しました')
  })
})
