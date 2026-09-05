import { describe, expect, it, vi } from 'vitest'

import {
  clearTodoDraft,
  DEFAULT_TODO_DRAFT,
  loadTodoDraft,
  saveTodoDraft,
  TODO_DRAFT_STORAGE_KEY,
} from './todoDraft'

describe('Todo draft', () => {
  it('saves, restores, and clears an unfinished Todo', () => {
    let storedValue: string | null = null
    const storage = {
      getItem: vi.fn(() => storedValue),
      setItem: vi.fn((_key: string, value: string) => {
        storedValue = value
      }),
      removeItem: vi.fn(() => {
        storedValue = null
      }),
    }
    const draft = {
      title: '確認用ToDo',
      description: '再読み込み後も残す',
      dueDate: '2026-08-04',
      priority: 'high' as const,
      category: '確認',
      equipmentDepartmentId: '10000000-0000-4000-8000-000000000001',
      equipmentId: '30000000-0000-4000-8000-000000000001',
    }

    expect(saveTodoDraft(draft, storage)).toBe(true)
    expect(storage.setItem).toHaveBeenCalledWith(
      TODO_DRAFT_STORAGE_KEY,
      JSON.stringify(draft),
    )
    expect(loadTodoDraft(storage)).toEqual(draft)

    expect(clearTodoDraft(storage)).toBe(true)
    expect(storage.removeItem).toHaveBeenCalledWith(TODO_DRAFT_STORAGE_KEY)
    expect(loadTodoDraft(storage)).toEqual(DEFAULT_TODO_DRAFT)
  })

  it('removes the stored value when every field returns to its default', () => {
    const storage = {
      setItem: vi.fn(),
      removeItem: vi.fn(),
    }

    expect(saveTodoDraft(DEFAULT_TODO_DRAFT, storage)).toBe(true)
    expect(storage.removeItem).toHaveBeenCalledWith(TODO_DRAFT_STORAGE_KEY)
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it('uses safe field defaults for malformed or unsupported stored values', () => {
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({
          title: 42,
          description: '有効な説明',
          dueDate: '2026-02-30',
          priority: 'urgent',
          category: '長'.repeat(31),
        }),
      ),
    }

    expect(loadTodoDraft(storage)).toEqual({
      ...DEFAULT_TODO_DRAFT,
      description: '有効な説明',
    })
  })

  it('keeps the Todo form usable when browser storage is unavailable', () => {
    const readFailure = {
      getItem: vi.fn(() => {
        throw new Error('storage blocked')
      }),
    }
    const writeFailure = {
      setItem: vi.fn(() => {
        throw new Error('storage blocked')
      }),
      removeItem: vi.fn(),
    }
    const removeFailure = {
      removeItem: vi.fn(() => {
        throw new Error('storage blocked')
      }),
    }

    expect(loadTodoDraft(readFailure)).toEqual(DEFAULT_TODO_DRAFT)
    expect(
      saveTodoDraft({ ...DEFAULT_TODO_DRAFT, title: '下書き' }, writeFailure),
    ).toBe(false)
    expect(clearTodoDraft(removeFailure)).toBe(false)
  })
})
