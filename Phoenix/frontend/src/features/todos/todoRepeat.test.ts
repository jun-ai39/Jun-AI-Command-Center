import { describe, expect, it } from 'vitest'

import type { Todo } from './types'
import { TEST_EQUIPMENT_ID } from '../work-reports/testFixtures'
import {
  addMonthsToLocalDateString,
  getTodoRepeatOptions,
  makeTodoRepeatInput,
} from './todoRepeat'

const todo: Todo = {
  id: 'a0c8fb1c-f655-4f9c-87f9-dc4ebc941f31',
  title: '月次レポートを確認',
  description: '前月分の内容を確認する',
  due_date: '2026-08-15',
  priority: 'medium',
  category: '確認',
  equipment_id: TEST_EQUIPMENT_ID,
  is_pinned: false,
  is_completed: true,
  is_archived: false,
  created_at: '2026-08-01T10:00:00Z',
  updated_at: '2026-08-08T10:00:00Z',
}

describe('Todo repeat helpers', () => {
  it('moves month-end dates without overflowing into the next month', () => {
    expect(addMonthsToLocalDateString('2027-01-31', 1)).toBe('2027-02-28')
    expect(addMonthsToLocalDateString('2028-01-31', 1)).toBe('2028-02-29')
    expect(addMonthsToLocalDateString('2026-12-31', 1)).toBe('2027-01-31')
  })

  it('builds next dates from a future due date or today when overdue', () => {
    expect(getTodoRepeatOptions(todo, '2026-08-09')).toEqual([
      { label: '1週間後', dueDate: '2026-08-22' },
      { label: '1か月後', dueDate: '2026-09-15' },
    ])
    expect(
      getTodoRepeatOptions({ ...todo, due_date: '2026-08-01' }, '2026-08-09'),
    ).toEqual([
      { label: '1週間後', dueDate: '2026-08-16' },
      { label: '1か月後', dueDate: '2026-09-09' },
    ])
    expect(
      getTodoRepeatOptions({ ...todo, due_date: null }, '2026-08-09'),
    ).toEqual([
      { label: '1週間後', dueDate: '2026-08-16' },
      { label: '1か月後', dueDate: '2026-09-09' },
    ])
  })

  it('creates an active next Todo while preserving its details', () => {
    expect(makeTodoRepeatInput(todo, '2026-09-15')).toEqual({
      title: todo.title,
      description: todo.description,
      dueDate: '2026-09-15',
      priority: todo.priority,
      category: todo.category,
      equipmentId: TEST_EQUIPMENT_ID,
    })
  })
})
