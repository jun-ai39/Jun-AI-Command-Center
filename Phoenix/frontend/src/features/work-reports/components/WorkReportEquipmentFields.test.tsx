import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import {
  READY_EQUIPMENT_OPTIONS,
  TEST_DEPARTMENT_ID,
  TEST_EQUIPMENT_ID,
} from '../testFixtures'
import { WorkReportEquipmentFields } from './WorkReportEquipmentFields'

describe('WorkReportEquipmentFields', () => {
  it('shows only equipment belonging to the selected active department', () => {
    const markup = renderToStaticMarkup(
      <WorkReportEquipmentFields
        idPrefix="test-report"
        departmentId={TEST_DEPARTMENT_ID}
        equipmentId={TEST_EQUIPMENT_ID}
        state={READY_EQUIPMENT_OPTIONS}
        onDepartmentChange={vi.fn()}
        onEquipmentChange={vi.fn()}
        onReload={vi.fn()}
      />,
    )

    expect(markup).toContain('菓子パン')
    expect(markup).toContain('包装機 No.2')
    expect(markup).toContain(`value="${TEST_EQUIPMENT_ID}" selected=""`)
  })

  it('shows a retry action when equipment masters cannot load', () => {
    const markup = renderToStaticMarkup(
      <WorkReportEquipmentFields
        idPrefix="test-report"
        departmentId=""
        equipmentId=""
        state={{ phase: 'error' }}
        onDepartmentChange={vi.fn()}
        onEquipmentChange={vi.fn()}
        onReload={vi.fn()}
      />,
    )

    expect(markup).toContain('設備マスターを読み込めませんでした')
    expect(markup).toContain('もう一度読み込む')
  })
})
