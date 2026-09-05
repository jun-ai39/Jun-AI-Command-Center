export type PhoenixFontSize = 'standard' | 'large' | 'extra-large'
export type PhoenixBackgroundTheme = 'midnight' | 'soft-navy' | 'charcoal'

export type DisplayPreferences = {
  readonly fontSize: PhoenixFontSize
  readonly backgroundTheme: PhoenixBackgroundTheme
}

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem' | 'removeItem'>
type DisplayRoot = {
  readonly dataset: {
    phoenixFontSize?: string
    phoenixBackground?: string
  }
}

export const DISPLAY_PREFERENCES_STORAGE_KEY = 'phoenix.display-preferences.v1'

export const DEFAULT_DISPLAY_PREFERENCES: DisplayPreferences = {
  fontSize: 'standard',
  backgroundTheme: 'midnight',
}

function getBrowserStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null
  }

  try {
    return window.localStorage
  } catch {
    return null
  }
}

function getDocumentRoot(): HTMLElement | null {
  if (typeof document === 'undefined') {
    return null
  }

  return document.documentElement
}

function isFontSize(value: unknown): value is PhoenixFontSize {
  return value === 'standard' || value === 'large' || value === 'extra-large'
}

function isBackgroundTheme(value: unknown): value is PhoenixBackgroundTheme {
  return value === 'midnight' || value === 'soft-navy' || value === 'charcoal'
}

export function loadDisplayPreferences(
  storage: ReadableStorage | null = getBrowserStorage(),
): DisplayPreferences {
  if (!storage) {
    return DEFAULT_DISPLAY_PREFERENCES
  }

  try {
    const storedValue = storage.getItem(DISPLAY_PREFERENCES_STORAGE_KEY)
    if (!storedValue) {
      return DEFAULT_DISPLAY_PREFERENCES
    }

    const parsed: unknown = JSON.parse(storedValue)
    if (typeof parsed !== 'object' || parsed === null) {
      return DEFAULT_DISPLAY_PREFERENCES
    }

    const preferences = parsed as Record<string, unknown>
    return {
      fontSize: isFontSize(preferences.fontSize)
        ? preferences.fontSize
        : DEFAULT_DISPLAY_PREFERENCES.fontSize,
      backgroundTheme: isBackgroundTheme(preferences.backgroundTheme)
        ? preferences.backgroundTheme
        : DEFAULT_DISPLAY_PREFERENCES.backgroundTheme,
    }
  } catch {
    return DEFAULT_DISPLAY_PREFERENCES
  }
}

export function saveDisplayPreferences(
  preferences: DisplayPreferences,
  storage: WritableStorage | null = getBrowserStorage(),
): boolean {
  if (!storage) {
    return false
  }

  try {
    storage.setItem(
      DISPLAY_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    )
    return true
  } catch {
    return false
  }
}

export function resetDisplayPreferences(
  storage: Pick<Storage, 'removeItem'> | null = getBrowserStorage(),
): boolean {
  if (!storage) {
    return false
  }

  try {
    storage.removeItem(DISPLAY_PREFERENCES_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}

export function applyDisplayPreferences(
  preferences: DisplayPreferences,
  root: DisplayRoot | null = getDocumentRoot(),
) {
  if (!root) return

  root.dataset.phoenixFontSize = preferences.fontSize
  root.dataset.phoenixBackground = preferences.backgroundTheme
}

export function loadAndApplyDisplayPreferences(
  storage: ReadableStorage | null = getBrowserStorage(),
  root: DisplayRoot | null = getDocumentRoot(),
): DisplayPreferences {
  const preferences = loadDisplayPreferences(storage)
  applyDisplayPreferences(preferences, root)
  return preferences
}
