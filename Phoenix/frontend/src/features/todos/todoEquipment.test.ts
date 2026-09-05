import { describe, expect, it } from 'vitest'

import {
  READY_EQUIPMENT_OPTIONS,
  TEST_DEPARTMENT_ID,
  TEST_EQUIPMENT_ID,
} from '../work-reports/testFixtures'
import {
  getTodoEquipmentDepartmentId,
  getTodoEquipmentSummary,
} from './todoEquipment'

describe('todoEquipment', () => {
  it('resolves one linked equipment into a field-facing label', () => {
    expect(
      getTodoEquipmentDepartmentId(READY_EQUIPMENT_OPTIONS, TEST_EQUIPMENT_ID),
    ).toBe(TEST_DEPARTMENT_ID)
    expect(
      getTodoEquipmentSummary(READY_EQUIPMENT_OPTIONS, TEST_EQUIPMENT_ID),
    ).toEqual({ label: '菓子パン / 包装機 No.2', status: 'linked' })
  })

  it('keeps unlinked schedules quiet and explains unavailable master data', () => {
    expect(getTodoEquipmentSummary(READY_EQUIPMENT_OPTIONS, null)).toBeNull()
    expect(
      getTodoEquipmentSummary({ phase: 'loading' }, TEST_EQUIPMENT_ID),
    ).toEqual({
      label: '設備情報を読み込んでいます',
      status: 'loading',
    })
    expect(
      getTodoEquipmentSummary({ phase: 'error' }, TEST_EQUIPMENT_ID),
    ).toEqual({
      label: '設備情報を表示できません',
      status: 'unavailable',
    })
  })
})
