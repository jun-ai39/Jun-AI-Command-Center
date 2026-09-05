import { describe, expect, it } from 'vitest'

import type { InspectionTemplateItem } from '../inspection-templates/types'
import {
  buildInspectionRecordItems,
  getInspectionLiveJudgment,
} from './inspectionRecordForm'

const numberItem: InspectionTemplateItem = {
  id: '40000000-0000-4000-8000-000000000001',
  equipment_id: '30000000-0000-4000-8000-000000000002',
  cycle: 'daily',
  name: 'モーター電流',
  input_type: 'number',
  unit: 'A',
  normal_min: 10,
  normal_max: 15,
  normal_state: null,
  check_method: '操作盤の電流表示を確認する',
  caution_note: null,
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
  display_order: 20,
}

describe('inspection record form', () => {
  it('judges numeric boundaries and status choices immediately', () => {
    expect(getInspectionLiveJudgment(numberItem, '')).toBeNull()
    expect(getInspectionLiveJudgment(numberItem, '10')).toBe('normal')
    expect(getInspectionLiveJudgment(numberItem, '15')).toBe('normal')
    expect(getInspectionLiveJudgment(numberItem, '15.1')).toBe('abnormal')
    expect(getInspectionLiveJudgment(statusItem, 'normal')).toBe('normal')
    expect(getInspectionLiveJudgment(statusItem, 'abnormal')).toBe('abnormal')
  })

  it('builds one exact structured value for every template item', () => {
    expect(
      buildInspectionRecordItems([numberItem, statusItem], {
        [numberItem.id]: ' 12.4 ',
        [statusItem.id]: 'abnormal',
      }),
    ).toEqual({
      ok: true,
      items: [
        {
          templateItemId: numberItem.id,
          numberValue: 12.4,
          statusValue: null,
        },
        {
          templateItemId: statusItem.id,
          numberValue: null,
          statusValue: 'abnormal',
        },
      ],
    })
  })

  it('rejects missing and out-of-range values', () => {
    const result = buildInspectionRecordItems([numberItem, statusItem], {
      [numberItem.id]: '1000000000',
    })
    expect(result.ok).toBe(false)
    if (!result.ok) {
      expect(result.errors).toEqual([
        'モーター電流の数値を正しく入力してください。',
        'ベルト状態の判定を選択してください。',
      ])
    }
  })
})
