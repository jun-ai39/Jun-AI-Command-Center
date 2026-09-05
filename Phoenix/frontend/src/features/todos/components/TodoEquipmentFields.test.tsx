import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'

import {
  READY_EQUIPMENT_OPTIONS,
  TEST_DEPARTMENT_ID,
  TEST_EQUIPMENT_ID,
} from '../../work-reports/testFixtures'
import { TodoEquipmentFields } from './TodoEquipmentFields'

describe('TodoEquipmentFields', () => {
  it('offers an optional department and equipment selection', () => {
    const markup = renderToStaticMarkup(
      <TodoEquipmentFields
        idPrefix="todo-test"
        departmentId={TEST_DEPARTMENT_ID}
        equipmentId={TEST_EQUIPMENT_ID}
        state={READY_EQUIPMENT_OPTIONS}
        onDepartmentChange={vi.fn()}
        onEquipmentChange={vi.fn()}
        onReload={vi.fn()}
      />,
    )

    expect(markup).toContain('対象部門（任意）')
    expect(markup).toContain('対象設備（任意）')
    expect(markup).toContain(`value="${TEST_DEPARTMENT_ID}" selected=""`)
    expect(markup).toContain(`value="${TEST_EQUIPMENT_ID}" selected=""`)
    expect(markup).toContain('包装機 No.2')
    expect(markup).not.toContain('required=""')
  })

  it('keeps the form usable when equipment options fail to load', () => {
    const markup = renderToStaticMarkup(
      <TodoEquipmentFields
        idPrefix="todo-test"
        departmentId=""
        equipmentId=""
        state={{ phase: 'error' }}
        onDepartmentChange={vi.fn()}
        onEquipmentChange={vi.fn()}
        onReload={vi.fn()}
      />,
    )

    expect(markup).toContain('部門を読み込めません')
    expect(markup).toContain('設備マスターを読み込めませんでした。')
    expect(markup).toContain('もう一度読み込む')
    expect(markup).toContain('disabled=""')
  })
})
