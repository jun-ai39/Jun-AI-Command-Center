import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import type { Equipment } from '../../equipment-master/types'
import type { InspectionTemplateItem } from '../../inspection-templates/types'
import {
  InspectionRecordPanel,
  InspectionRecordWorkspaceContent,
} from './InspectionRecordPanel'

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
  name: 'ベルト状態',
  input_type: 'status',
  unit: null,
  normal_min: null,
  normal_max: null,
  normal_state: '亀裂・緩みなし',
  check_method: '停止状態でベルト表面を目視する',
  caution_note: '異常がある場合は経験者へ引き継ぐ',
  display_order: 20,
}

const baseProps = {
  inspectionDate: '2026-08-21',
  equipment,
  cycle: 'daily' as const,
  saveState: { phase: 'idle' } as const,
  onReload: vi.fn(),
  onSave: vi.fn(async () => null),
  onResetSave: vi.fn(),
}

describe('InspectionRecordWorkspaceContent', () => {
  it('shows structured number and status inputs from active masters', () => {
    const markup = renderToStaticMarkup(
      <InspectionRecordWorkspaceContent
        {...baseProps}
        state={{ phase: 'ready', items: [numberItem, statusItem] }}
      />,
    )

    expect(markup).toContain('包装機 No.2')
    expect(markup).toContain('毎日点検')
    expect(markup).toContain('2項目')
    expect(markup).toContain('モーター電流')
    expect(markup).toContain('正常範囲：10 ～ 15 A')
    expect(markup).toContain('操作盤の電流表示を運転中に確認する')
    expect(markup).toContain('回転部へ手を近づけない')
    expect(markup).toContain(`id="inspection-record-value-${numberItem.id}"`)
    expect(markup).toContain('ベルト状態')
    expect(markup).toContain('正常状態：亀裂・緩みなし')
    expect(markup).toContain('停止状態でベルト表面を目視する')
    expect(markup).toContain('異常がある場合は経験者へ引き継ぐ')
    expect(markup).toContain(`id="inspection-record-${statusItem.id}-normal"`)
    expect(markup).toContain(`id="inspection-record-${statusItem.id}-abnormal"`)
    expect(markup).toContain('点検記録を保存')
    expect(markup).toContain('同じ設備の記録を重複保存できません')
  })

  it('shows loading, empty, and recoverable error states', () => {
    const loadingMarkup = renderToStaticMarkup(
      <InspectionRecordWorkspaceContent
        {...baseProps}
        state={{ phase: 'loading' }}
      />,
    )
    const emptyMarkup = renderToStaticMarkup(
      <InspectionRecordWorkspaceContent
        {...baseProps}
        state={{ phase: 'ready', items: [] }}
      />,
    )
    const errorMarkup = renderToStaticMarkup(
      <InspectionRecordWorkspaceContent
        {...baseProps}
        state={{ phase: 'error' }}
      />,
    )

    expect(loadingMarkup).toContain('点検項目を読み込んでいます')
    expect(emptyMarkup).toContain('この周期の点検項目は未設定です')
    expect(emptyMarkup).toContain('設備別点検項目マスター')
    expect(errorMarkup).toContain('点検項目を読み込めませんでした')
    expect(errorMarkup).toContain('もう一度読み込む')
  })

  it('shows the duplicate-period guidance returned by the save action', () => {
    const markup = renderToStaticMarkup(
      <InspectionRecordWorkspaceContent
        {...baseProps}
        state={{ phase: 'ready', items: [numberItem] }}
        saveState={{
          phase: 'error',
          message:
            'この設備・周期の点検記録は、対象期間にすでに保存されています。',
        }}
      />,
    )

    expect(markup).toContain('対象期間にすでに保存されています')
  })
})

describe('InspectionRecordPanel', () => {
  it('shows the equipment and cycle received from periodic inspection status', () => {
    const markup = renderToStaticMarkup(
      <InspectionRecordPanel
        equipmentOptionsState={{
          phase: 'ready',
          departments: [
            {
              id: equipment.department_id,
              name: '菓子パン',
              display_order: 10,
              is_active: true,
              created_at: equipment.created_at,
              updated_at: equipment.updated_at,
            },
          ],
          equipment: [equipment],
        }}
        onReloadEquipmentOptions={vi.fn()}
        onSaved={vi.fn()}
        selection={{
          equipmentId: equipment.equipment_id,
          departmentName: '菓子パン',
          equipmentName: equipment.name,
          equipmentNumber: equipment.equipment_number,
          cycle: 'weekly',
        }}
      />,
    )

    expect(markup).toContain('定期点検から選択しました')
    expect(markup).toContain('菓子パン / 包装機 No.2')
    expect(markup).toContain('毎週点検')
    expect(markup).toContain(
      `<option value="${equipment.equipment_id}" selected="">`,
    )
    expect(markup).toContain('<option value="weekly" selected="">毎週</option>')
  })
})
