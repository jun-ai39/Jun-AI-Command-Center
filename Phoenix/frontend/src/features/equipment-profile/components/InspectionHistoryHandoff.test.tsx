import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import type { Equipment } from '../../equipment-master/types'
import type { InspectionRecord } from '../../inspection-records/types'
import { InspectionHistoryHandoff } from './InspectionHistoryHandoff'

const equipment: Equipment = {
  equipment_id: '30000000-0000-4000-8000-000000000001',
  department_id: '10000000-0000-4000-8000-000000000001',
  manufacturer_id: '20000000-0000-4000-8000-000000000001',
  name: '包装機',
  equipment_number: 'No.2',
  model_number: 'TEST-200',
  photo_path: null,
  is_active: true,
  created_at: '2026-08-20T01:00:00+00:00',
  updated_at: '2026-08-20T01:00:00+00:00',
}

const inspection: InspectionRecord = {
  id: '50000000-0000-4000-8000-000000000001',
  inspection_date: '2026-08-22',
  equipment_id: equipment.equipment_id,
  equipment_name: equipment.name,
  equipment_number: equipment.equipment_number,
  cycle: 'daily',
  period_key: '2026-08-22',
  overall_judgment: 'abnormal',
  items: [
    {
      id: '60000000-0000-4000-8000-000000000001',
      template_item_id: '40000000-0000-4000-8000-000000000001',
      name: 'モーター電流',
      input_type: 'number',
      number_value: 16.2,
      status_value: null,
      unit: 'A',
      normal_min: 10,
      normal_max: 15,
      normal_state: null,
      judgment: 'abnormal',
      display_order: 10,
    },
    {
      id: '60000000-0000-4000-8000-000000000002',
      template_item_id: '40000000-0000-4000-8000-000000000002',
      name: 'ベルト状態',
      input_type: 'status',
      number_value: null,
      status_value: 'normal',
      unit: null,
      normal_min: null,
      normal_max: null,
      normal_state: '亀裂・緩みなし',
      judgment: 'normal',
      display_order: 20,
    },
  ],
  created_at: '2026-08-22T01:00:00+00:00',
  updated_at: '2026-08-22T01:00:00+00:00',
}

describe('inspection history handoff', () => {
  it('transfers the selected historical date, cycle and only abnormal items on click', () => {
    const onStartWorkReport = vi.fn()
    const record = {
      ...inspection,
      inspection_date: '2025-01-02',
      cycle: 'monthly' as const,
    }
    const element = InspectionHistoryHandoff({
      record,
      equipment,
      onStartWorkReport,
    })
    expect(onStartWorkReport).not.toHaveBeenCalled()
    expect(renderToStaticMarkup(element)).toContain('自動では登録されません')
    const button = element!.props.children[1]
    button.props.onClick()
    expect(onStartWorkReport).toHaveBeenCalledExactlyOnceWith({
      source: 'inspection',
      workDate: '2025-01-02',
      departmentId: equipment.department_id,
      equipmentId: equipment.equipment_id,
      phenomenon: '毎月点検で異常を確認：モーター電流',
      workContent:
        '点検で異常を確認したため、設備の状態を確認し、必要な対応を引き継ぐ。',
      progress: 'continued',
    })
  })
  it('does not offer a handoff for normal records or records without abnormal items', () => {
    const onStartWorkReport = vi.fn()
    for (const record of [
      { ...inspection, overall_judgment: 'normal' as const },
      {
        ...inspection,
        items: inspection.items.filter((item) => item.judgment === 'normal'),
      },
    ]) {
      expect(
        InspectionHistoryHandoff({ record, equipment, onStartWorkReport }),
      ).toBeNull()
    }
    expect(onStartWorkReport).not.toHaveBeenCalled()
  })
  it('does not transfer a record belonging to a different equipment or without a handler', () => {
    expect(
      InspectionHistoryHandoff({ record: inspection, equipment }),
    ).toBeNull()
    expect(
      InspectionHistoryHandoff({
        record: { ...inspection, equipment_id: 'other' },
        equipment,
        onStartWorkReport: vi.fn(),
      }),
    ).toBeNull()
  })
})
