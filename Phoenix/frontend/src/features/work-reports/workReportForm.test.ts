import { describe, expect, it } from 'vitest'

import {
  formatWorkReportDate,
  getLocalDateInputValue,
  getWorkReportProgressLabel,
  validateWorkReport,
} from './workReportForm'
import {
  READY_EQUIPMENT_OPTIONS,
  TEST_DEPARTMENT_ID,
  TEST_EQUIPMENT_ID,
} from './testFixtures'

describe('work report form', () => {
  it('normalizes the seven fields while allowing an unresolved cause', () => {
    const result = validateWorkReport(
      {
        workDate: '2026-08-21',
        departmentId: TEST_DEPARTMENT_ID,
        equipmentId: TEST_EQUIPMENT_ID,
        phenomenon: '  搬送部から周期的な異音  ',
        cause: '   ',
        workContent: '  安全な範囲で外観を確認  ',
        progress: 'follow_up',
      },
      READY_EQUIPMENT_OPTIONS,
    )

    expect(result).toEqual({
      ok: true,
      value: {
        workDate: '2026-08-21',
        departmentId: TEST_DEPARTMENT_ID,
        equipmentId: TEST_EQUIPMENT_ID,
        phenomenon: '搬送部から周期的な異音',
        cause: '',
        workContent: '安全な範囲で外観を確認',
        progress: 'follow_up',
      },
    })
  })

  it('reports every missing required field before confirmation', () => {
    const result = validateWorkReport(
      {
        workDate: '',
        departmentId: '',
        equipmentId: '',
        phenomenon: '   ',
        cause: '',
        workContent: '   ',
        progress: '',
      },
      READY_EQUIPMENT_OPTIONS,
    )

    expect(result).toEqual({
      ok: false,
      errors: [
        '作業日を正しく入力してください。',
        '部門を選択してください。',
        '設備を選択してください。',
        '現象を入力してください。',
        '作業内容を入力してください。',
        '進捗を選択してください。',
      ],
    })
  })

  it('formats dates and progress labels for Japanese review text', () => {
    expect(getLocalDateInputValue(new Date(2026, 7, 6))).toBe('2026-08-06')
    expect(formatWorkReportDate('2026-08-06')).toBe('2026年8月6日')
    expect(getWorkReportProgressLabel('follow_up')).toBe('経過確認')
  })
})
