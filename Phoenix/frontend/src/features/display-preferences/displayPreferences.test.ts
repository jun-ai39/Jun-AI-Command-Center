import { describe, expect, it, vi } from 'vitest'

import {
  applyDisplayPreferences,
  DEFAULT_DISPLAY_PREFERENCES,
  DISPLAY_PREFERENCES_STORAGE_KEY,
  loadAndApplyDisplayPreferences,
  loadDisplayPreferences,
  resetDisplayPreferences,
  saveDisplayPreferences,
} from './displayPreferences'

describe('display preferences', () => {
  it('saves, restores, and applies a supported font size and background', () => {
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
    const root = { dataset: {} as Record<string, string> }
    const preferences = {
      fontSize: 'extra-large' as const,
      backgroundTheme: 'charcoal' as const,
    }

    expect(saveDisplayPreferences(preferences, storage)).toBe(true)
    expect(storage.setItem).toHaveBeenCalledWith(
      DISPLAY_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    )
    expect(loadAndApplyDisplayPreferences(storage, root)).toEqual(preferences)
    expect(root.dataset).toEqual({
      phoenixFontSize: 'extra-large',
      phoenixBackground: 'charcoal',
    })
  })

  it('uses safe defaults for malformed or unsupported stored values', () => {
    const partiallyInvalidStorage = {
      getItem: vi.fn(() =>
        JSON.stringify({
          fontSize: 'huge',
          backgroundTheme: 'soft-navy',
        }),
      ),
    }
    const malformedStorage = {
      getItem: vi.fn(() => '{broken'),
    }

    expect(loadDisplayPreferences(partiallyInvalidStorage)).toEqual({
      ...DEFAULT_DISPLAY_PREFERENCES,
      backgroundTheme: 'soft-navy',
    })
    expect(loadDisplayPreferences(malformedStorage)).toEqual(
      DEFAULT_DISPLAY_PREFERENCES,
    )
  })

  it('keeps the screen usable when browser storage is unavailable', () => {
    const readFailure = {
      getItem: vi.fn(() => {
        throw new Error('storage blocked')
      }),
    }
    const writeFailure = {
      setItem: vi.fn(() => {
        throw new Error('storage blocked')
      }),
      removeItem: vi.fn(() => {
        throw new Error('storage blocked')
      }),
    }
    const root = { dataset: {} as Record<string, string> }

    expect(loadDisplayPreferences(readFailure)).toEqual(
      DEFAULT_DISPLAY_PREFERENCES,
    )
    expect(
      saveDisplayPreferences(DEFAULT_DISPLAY_PREFERENCES, writeFailure),
    ).toBe(false)
    expect(resetDisplayPreferences(writeFailure)).toBe(false)

    applyDisplayPreferences(DEFAULT_DISPLAY_PREFERENCES, root)
    expect(root.dataset).toEqual({
      phoenixFontSize: 'standard',
      phoenixBackground: 'midnight',
    })
  })
})
