import { describe, expect, it } from 'vitest'

import type { WorkReport } from '../work-reports/types'
import {
  createEmptyEquipmentChangeHistoryForm,
  getLocalDateInputValue,
  validateEquipmentChangeHistoryForm,
} from './equipmentChangeHistoryForm'

const equipmentId = '30000000-0000-4000-8000-000000000001'
const report: WorkReport = {
  id: '90000000-0000-4000-8000-000000000001',
  work_date: '2026-08-26',
  department_id: '10000000-0000-4000-8000-000000000001',
  equipment_id: equipmentId,
  department_name: '菓子パン',
  equipment_name: '包装機',
  equipment_number: 'No.2',
  phenomenon: '搬送部の蛇行',
  cause: 'ガイド形状',
  work_content: '架空ガイド形状を変更',
  progress: 'completed',
  is_legacy: false,
  legacy_category: null,
  legacy_work_hours: null,
  legacy_notes: null,
  created_at: '2026-08-26T01:00:00+00:00',
  updated_at: '2026-08-26T01:00:00+00:00',
}

describe('equipment change history form', () => {
  it('creates a local date without shifting across time zones', () => {
    const now = new Date('2026-08-25T15:30:00.000Z')
    const originalOffset = now.getTimezoneOffset
    now.getTimezoneOffset = () => -540

    expect(getLocalDateInputValue(now)).toBe('2026-08-26')
    expect(createEmptyEquipmentChangeHistoryForm(now)).toEqual({
      changedOn: '2026-08-26',
      improvementPoint: '',
      changeDetails: '',
      workReportId: '',
    })
    now.getTimezoneOffset = originalOffset
  })

  it('normalizes valid input and keeps the optional same-equipment report', () => {
    expect(
      validateEquipmentChangeHistoryForm(
        {
          changedOn: '2026-08-26',
          improvementPoint: '  チェーンガイドの搬送安定化  ',
          changeDetails: '  架空ガイド形状を変更した。  ',
          workReportId: report.id,
        },
        equipmentId,
        [report],
      ),
    ).toEqual({
      ok: true,
      value: {
        equipmentId,
        changedOn: '2026-08-26',
        improvementPoint: 'チェーンガイドの搬送安定化',
        changeDetails: '架空ガイド形状を変更した。',
        workReportId: report.id,
      },
    })
  })

  it('allows an independent history without a work report', () => {
    const result = validateEquipmentChangeHistoryForm(
      {
        changedOn: '2026-08-26',
        improvementPoint: '操作位置の視認性向上',
        changeDetails: '架空ラベルを大きくした。',
        workReportId: '',
      },
      equipmentId,
      [],
    )
    expect(result).toMatchObject({
      ok: true,
      value: { workReportId: null },
    })
  })

  it('rejects missing text, invalid dates, and reports outside the equipment', () => {
    const result = validateEquipmentChangeHistoryForm(
      {
        changedOn: '2026-02-30',
        improvementPoint: ' ',
        changeDetails: ' ',
        workReportId: report.id,
      },
      '30000000-0000-4000-8000-000000000002',
      [report],
    )
    expect(result).toEqual({
      ok: false,
      errors: [
        '改良・変更日を正しく入力してください。',
        '改良ポイントを入力してください。',
        '変更内容を入力してください。',
        '関連日報は、この設備に表示中の日報から選択してください。',
      ],
    })
  })
})
