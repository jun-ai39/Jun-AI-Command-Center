import { describe, expect, it } from 'vitest'

import type { Todo } from './types'
import { buildTodosCsv, parseTodosCsv, TodoCsvError } from './todoCsv'

const todo: Todo = {
  id: 'a48af9d2-e26c-469f-bbeb-2d99ffbd15c2',
  title: 'Phoenix UIを確認する',
  description: 'PCとスマートフォンで操作を確認する',
  due_date: '2026-08-04',
  priority: 'high',
  category: '開発',
  equipment_id: null,
  is_pinned: false,
  is_completed: false,
  is_archived: false,
  created_at: '2026-08-03T12:00:00Z',
  updated_at: '2026-08-03T12:30:00Z',
}

describe('buildTodosCsv', () => {
  it('builds an Excel-readable Japanese CSV with a UTF-8 BOM', () => {
    const csv = buildTodosCsv([todo])

    expect(csv.startsWith('\uFEFF')).toBe(true)
    expect(csv).toContain(
      '"タイトル","説明","期限","優先度","カテゴリ","状態","固定","作成日時","更新日時"',
    )
    expect(csv).toContain(
      '"Phoenix UIを確認する","PCとスマートフォンで操作を確認する","2026-08-04","高","開発","未完了","通常"',
    )
  })

  it('escapes quotes and line breaks and neutralizes spreadsheet formulas', () => {
    const csv = buildTodosCsv([
      {
        ...todo,
        title: '=2+2',
        description: '1行目\n"2行目"',
        category: '@SUM(A1:A2)',
      },
    ])

    expect(csv).toContain('"\'=2+2"')
    expect(csv).toContain('"1行目\n""2行目"""')
    expect(csv).toContain('"\'@SUM(A1:A2)"')
  })
})

describe('parseTodosCsv', () => {
  it('reads an exported CSV while preserving completion and pinned states', () => {
    const csv = buildTodosCsv([
      todo,
      { ...todo, is_completed: true, is_pinned: true },
    ])

    expect(parseTodosCsv(csv)).toEqual([
      {
        title: todo.title,
        description: todo.description,
        dueDate: todo.due_date,
        priority: todo.priority,
        category: todo.category,
        isCompleted: false,
        isPinned: false,
      },
      {
        title: todo.title,
        description: todo.description,
        dueDate: todo.due_date,
        priority: todo.priority,
        category: todo.category,
        isCompleted: true,
        isPinned: true,
      },
    ])
  })

  it('continues importing legacy CSV files as unpinned Todos', () => {
    const legacyCsv = [
      '"タイトル","説明","期限","優先度","カテゴリ","状態","作成日時","更新日時"',
      '"旧CSVを確認","以前の形式","","中","確認","未完了","2026-08-03T12:00:00Z","2026-08-03T12:30:00Z"',
    ].join('\r\n')

    expect(parseTodosCsv(legacyCsv)[0]).toEqual({
      title: '旧CSVを確認',
      description: '以前の形式',
      dueDate: '',
      priority: 'medium',
      category: '確認',
      isCompleted: false,
      isPinned: false,
    })
  })

  it('restores protected formulas and preserves quoted line breaks', () => {
    const csv = buildTodosCsv([
      {
        ...todo,
        title: '=2+2',
        description: '1行目\n"2行目"',
        category: '@確認',
      },
    ])

    expect(parseTodosCsv(csv)[0]).toEqual(
      expect.objectContaining({
        title: '=2+2',
        description: '1行目\n"2行目"',
        category: '@確認',
      }),
    )
  })

  it('rejects an unexpected header before any data is returned', () => {
    expect(() => parseTodosCsv('"名前","説明"\r\n"確認","内容"')).toThrow(
      TodoCsvError,
    )
  })

  it('rejects invalid dates and unsupported priority labels', () => {
    const invalidDate = buildTodosCsv([todo]).replace(
      '"2026-08-04"',
      '"2026-02-30"',
    )
    const invalidPriority = buildTodosCsv([todo]).replace('"高"', '"最優先"')

    expect(() => parseTodosCsv(invalidDate)).toThrow('期限が正しくありません')
    expect(() => parseTodosCsv(invalidPriority)).toThrow(
      '優先度は「高」「中」「低」',
    )
  })

  it('rejects an unsupported pinned state label', () => {
    const invalidPinnedState = buildTodosCsv([todo]).replace('"通常"', '"維持"')

    expect(() => parseTodosCsv(invalidPinnedState)).toThrow(
      '固定欄は「固定」または「通常」',
    )
  })

  it('limits one import to fifty Todo items', () => {
    const csv = buildTodosCsv(
      Array.from({ length: 51 }, (_, index) => ({
        ...todo,
        title: `${index + 1}件目`,
      })),
    )

    expect(() => parseTodosCsv(csv)).toThrow(
      '一度に登録できるToDoは50件までです。',
    )
  })
})
