import { describe, expect, it, vi } from 'vitest'

import type { Todo } from './types'
import { buildTodoClipboardText, copyTodoToClipboard } from './todoClipboard'

const todo: Todo = {
  id: '965145f4-6466-4bf8-a8a5-cda9026fb9a3',
  title: '共有用ToDo',
  description: '手順を確認する',
  due_date: '2026-08-06',
  priority: 'high',
  category: '確認',
  equipment_id: null,
  is_pinned: false,
  is_completed: false,
  is_archived: false,
  created_at: '2026-08-03T10:00:00Z',
  updated_at: '2026-08-03T10:00:00Z',
}

describe('Todo clipboard', () => {
  it('builds a readable summary from every user-facing Todo field', () => {
    expect(buildTodoClipboardText(todo)).toBe(
      [
        'ToDo: 共有用ToDo',
        '状態: 未完了',
        '期限: 2026-08-06',
        '優先度: 高',
        'カテゴリ: 確認',
        '説明: 手順を確認する',
      ].join('\n'),
    )
  })

  it('uses readable placeholders for optional fields', () => {
    expect(
      buildTodoClipboardText({
        ...todo,
        description: null,
        due_date: null,
        category: null,
        is_completed: true,
        priority: 'low',
      }),
    ).toContain(
      [
        '状態: 完了',
        '期限: なし',
        '優先度: 低',
        'カテゴリ: なし',
        '説明: なし',
      ].join('\n'),
    )
  })

  it('writes the summary to an available clipboard', async () => {
    const clipboard = { writeText: vi.fn(async () => undefined) }

    await expect(copyTodoToClipboard(todo, clipboard)).resolves.toBe(true)
    expect(clipboard.writeText).toHaveBeenCalledWith(
      buildTodoClipboardText(todo),
    )
  })

  it('uses the selection fallback when clipboard permission is rejected', async () => {
    const rejectedClipboard = {
      writeText: vi.fn(async () => {
        throw new Error('clipboard blocked')
      }),
    }
    const fallback = vi.fn(() => true)

    await expect(
      copyTodoToClipboard(todo, rejectedClipboard, fallback),
    ).resolves.toBe(true)
    expect(fallback).toHaveBeenCalledWith(buildTodoClipboardText(todo))
  })

  it('reports unavailable clipboard writes safely', async () => {
    const rejectedClipboard = {
      writeText: vi.fn(async () => {
        throw new Error('clipboard blocked')
      }),
    }
    const rejectedFallback = vi.fn(() => false)

    await expect(
      copyTodoToClipboard(todo, null, rejectedFallback),
    ).resolves.toBe(false)
    await expect(
      copyTodoToClipboard(todo, rejectedClipboard, rejectedFallback),
    ).resolves.toBe(false)
  })
})
