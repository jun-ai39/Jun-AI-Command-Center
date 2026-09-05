import type { TodoPriority } from './types'

export type TodoDraft = {
  readonly title: string
  readonly description: string
  readonly dueDate: string
  readonly priority: TodoPriority
  readonly category: string
  readonly equipmentDepartmentId: string
  readonly equipmentId: string
}

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem' | 'removeItem'>

export const TODO_DRAFT_STORAGE_KEY = 'phoenix.todo.draft.v1'

export const DEFAULT_TODO_DRAFT: TodoDraft = {
  title: '',
  description: '',
  dueDate: '',
  priority: 'medium',
  category: '',
  equipmentDepartmentId: '',
  equipmentId: '',
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

function getSafeString(value: unknown, maxLength: number): string {
  return typeof value === 'string' && value.length <= maxLength ? value : ''
}

function isTodoPriority(value: unknown): value is TodoPriority {
  return value === 'high' || value === 'medium' || value === 'low'
}

function isValidDateInput(value: unknown): value is string {
  if (value === '') {
    return true
  }
  if (typeof value !== 'string') {
    return false
  }

  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!match) {
    return false
  }

  const [, yearValue, monthValue, dayValue] = match
  const year = Number(yearValue)
  const month = Number(monthValue)
  const day = Number(dayValue)
  const date = new Date(year, month - 1, day)
  return (
    date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
  )
}

function isEmptyDraft(draft: TodoDraft): boolean {
  return (
    draft.title === DEFAULT_TODO_DRAFT.title &&
    draft.description === DEFAULT_TODO_DRAFT.description &&
    draft.dueDate === DEFAULT_TODO_DRAFT.dueDate &&
    draft.priority === DEFAULT_TODO_DRAFT.priority &&
    draft.category === DEFAULT_TODO_DRAFT.category &&
    draft.equipmentDepartmentId === DEFAULT_TODO_DRAFT.equipmentDepartmentId &&
    draft.equipmentId === DEFAULT_TODO_DRAFT.equipmentId
  )
}

export function loadTodoDraft(
  storage: ReadableStorage | null = getBrowserStorage(),
): TodoDraft {
  if (!storage) {
    return DEFAULT_TODO_DRAFT
  }

  try {
    const storedValue = storage.getItem(TODO_DRAFT_STORAGE_KEY)
    if (!storedValue) {
      return DEFAULT_TODO_DRAFT
    }

    const parsed: unknown = JSON.parse(storedValue)
    if (typeof parsed !== 'object' || parsed === null) {
      return DEFAULT_TODO_DRAFT
    }

    const draft = parsed as Record<string, unknown>
    return {
      title: getSafeString(draft.title, 200),
      description: getSafeString(draft.description, 5000),
      dueDate: isValidDateInput(draft.dueDate) ? draft.dueDate : '',
      priority: isTodoPriority(draft.priority) ? draft.priority : 'medium',
      category: getSafeString(draft.category, 30),
      equipmentDepartmentId: getSafeString(draft.equipmentDepartmentId, 36),
      equipmentId: getSafeString(draft.equipmentId, 36),
    }
  } catch {
    return DEFAULT_TODO_DRAFT
  }
}

export function saveTodoDraft(
  draft: TodoDraft,
  storage: WritableStorage | null = getBrowserStorage(),
): boolean {
  if (!storage) {
    return false
  }

  try {
    if (isEmptyDraft(draft)) {
      storage.removeItem(TODO_DRAFT_STORAGE_KEY)
    } else {
      storage.setItem(TODO_DRAFT_STORAGE_KEY, JSON.stringify(draft))
    }
    return true
  } catch {
    return false
  }
}

export function clearTodoDraft(
  storage: Pick<Storage, 'removeItem'> | null = getBrowserStorage(),
): boolean {
  if (!storage) {
    return false
  }

  try {
    storage.removeItem(TODO_DRAFT_STORAGE_KEY)
    return true
  } catch {
    return false
  }
}
