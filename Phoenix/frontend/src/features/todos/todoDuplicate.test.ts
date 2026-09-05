import { describe, expect, it } from 'vitest'

import type { Todo, TodoCreateInput } from './types'
import { TEST_EQUIPMENT_ID } from '../work-reports/testFixtures'
import {
  countTodoInputsMatchingExistingTitles,
  countTodosWithMatchingTitle,
  getTodoInputExcludedIndexes,
  getTodoInputIndexesMatchingExistingTitles,
  getTodoInputIndexesWithRepeatedTitles,
  getTodoInputsExcludingIndexes,
  makeTodoDuplicateInput,
} from './todoDuplicate'

const todo: Todo = {
  id: '25e98221-c09a-4616-93c5-721d52cd24fc',
  title: '定期点検を確認',
  description: '月次点検の記録を確認する',
  due_date: '2026-08-10',
  priority: 'high',
  category: '確認',
  equipment_id: TEST_EQUIPMENT_ID,
  is_pinned: false,
  is_completed: false,
  is_archived: false,
  created_at: '2026-08-03T10:00:00Z',
  updated_at: '2026-08-03T10:00:00Z',
}

describe('Todo duplicate helpers', () => {
  it('counts normalized duplicate titles without partial matches', () => {
    const todos = [
      todo,
      { ...todo, id: 'full-width', title: 'ＤＡＹ５を確認' },
      { ...todo, id: 'partial', title: '定期点検を確認する' },
    ]

    expect(countTodosWithMatchingTitle(todos, '　定期点検を確認　')).toBe(1)
    expect(countTodosWithMatchingTitle(todos, 'day5を確認')).toBe(1)
    expect(countTodosWithMatchingTitle(todos, '定期点検')).toBe(0)
    expect(countTodosWithMatchingTitle(todos, '   ')).toBe(0)
  })

  it('counts CSV inputs that match existing normalized titles', () => {
    const todos = [todo, { ...todo, id: 'full-width', title: 'ＤＡＹ５を確認' }]
    const inputs = [
      { title: ' 定期点検を確認 ' },
      { title: 'day5を確認' },
      { title: '新しいToDo' },
      { title: '   ' },
    ]

    expect(countTodoInputsMatchingExistingTitles(todos, inputs)).toBe(2)
    expect(getTodoInputIndexesMatchingExistingTitles(todos, inputs)).toEqual([
      0, 1,
    ])
  })

  it('identifies only later normalized title repetitions inside a CSV', () => {
    const inputs = [
      { title: '週次予定を確認' },
      { title: ' 週次予定を確認 ' },
      { title: '別のToDo' },
      { title: 'ＤＡＹ５を確認' },
      { title: 'day5を確認' },
      { title: '   ' },
    ]

    expect(getTodoInputIndexesWithRepeatedTitles(inputs)).toEqual([1, 4])
  })

  it('excludes only the selected CSV input indexes', () => {
    const inputs: readonly TodoCreateInput[] = [
      {
        title: '定期点検を確認',
        description: '',
        dueDate: '',
        priority: 'high',
        category: '確認',
      },
      {
        title: '新しいToDo',
        description: '',
        dueDate: '',
        priority: 'medium',
        category: '',
      },
    ]

    expect(getTodoInputsExcludingIndexes(inputs, new Set([0]))).toEqual([
      inputs[1],
    ])
    expect(getTodoInputsExcludingIndexes(inputs, new Set())).toEqual(inputs)
  })

  it('combines valid individual and duplicate CSV exclusions', () => {
    expect(
      getTodoInputExcludedIndexes(4, new Set([1, 9]), new Set([0, 1, 3]), true),
    ).toEqual(new Set([0, 1, 3]))
    expect(
      getTodoInputExcludedIndexes(4, new Set([1, 9]), new Set([0, 3]), false),
    ).toEqual(new Set([1]))
  })

  it('builds an active copy while preserving task details', () => {
    expect(makeTodoDuplicateInput(todo)).toEqual({
      title: '定期点検を確認（コピー）',
      description: todo.description,
      dueDate: todo.due_date,
      priority: todo.priority,
      category: todo.category,
      equipmentId: TEST_EQUIPMENT_ID,
    })
  })
})
