import { describe, expect, it, vi } from 'vitest'

import {
  DEFAULT_TODO_VIEW_PREFERENCES,
  loadTodoViewPreferences,
  saveTodoViewPreferences,
  TODO_VIEW_PREFERENCES_STORAGE_KEY,
} from './todoViewPreferences'

describe('Todo view preferences', () => {
  it('saves and restores supported filters and sorting', () => {
    let storedValue: string | null = null
    const storage = {
      getItem: vi.fn(() => storedValue),
      setItem: vi.fn((_key: string, value: string) => {
        storedValue = value
      }),
    }
    const preferences = {
      statusFilter: 'active' as const,
      dueFilter: 'next7days' as const,
      priorityFilter: 'high' as const,
      pinnedFilter: 'unpinned' as const,
      categoryFilter: 'category:%E5%AD%A6%E7%BF%92' as const,
      sortOption: 'updated' as const,
    }

    expect(saveTodoViewPreferences(preferences, storage)).toBe(true)
    expect(storage.setItem).toHaveBeenCalledWith(
      TODO_VIEW_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    )
    expect(loadTodoViewPreferences(storage)).toEqual(preferences)
  })

  it('uses safe defaults for malformed or unsupported stored values', () => {
    const storage = {
      getItem: vi.fn(() =>
        JSON.stringify({
          statusFilter: 'unknown',
          dueFilter: 'overdue',
          priorityFilter: 1,
          pinnedFilter: 'unknown',
          categoryFilter: 'category:%E0%A4%A',
          sortOption: 'random',
        }),
      ),
    }

    expect(loadTodoViewPreferences(storage)).toEqual({
      ...DEFAULT_TODO_VIEW_PREFERENCES,
      dueFilter: 'overdue',
    })
  })

  it('keeps the Todo screen usable when browser storage is unavailable', () => {
    const readFailure = {
      getItem: vi.fn(() => {
        throw new Error('storage blocked')
      }),
    }
    const writeFailure = {
      setItem: vi.fn(() => {
        throw new Error('storage blocked')
      }),
    }

    expect(loadTodoViewPreferences(readFailure)).toEqual(
      DEFAULT_TODO_VIEW_PREFERENCES,
    )
    expect(
      saveTodoViewPreferences(DEFAULT_TODO_VIEW_PREFERENCES, writeFailure),
    ).toBe(false)
  })
})
