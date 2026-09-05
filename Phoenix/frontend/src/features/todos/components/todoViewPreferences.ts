import type {
  TodoCategoryFilter,
  TodoDueFilter,
  TodoPinnedFilter,
  TodoPriorityFilter,
  TodoSortOption,
  TodoStatusFilter,
} from './todoFilters'

export type TodoViewPreferences = {
  readonly statusFilter: TodoStatusFilter
  readonly dueFilter: TodoDueFilter
  readonly priorityFilter: TodoPriorityFilter
  readonly pinnedFilter: TodoPinnedFilter
  readonly categoryFilter: TodoCategoryFilter
  readonly sortOption: TodoSortOption
}

type ReadableStorage = Pick<Storage, 'getItem'>
type WritableStorage = Pick<Storage, 'setItem'>

export const TODO_VIEW_PREFERENCES_STORAGE_KEY =
  'phoenix.todo.view-preferences.v1'

export const DEFAULT_TODO_VIEW_PREFERENCES: TodoViewPreferences = {
  statusFilter: 'all',
  dueFilter: 'all',
  priorityFilter: 'all',
  pinnedFilter: 'all',
  categoryFilter: 'all',
  sortOption: 'due',
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

function isStatusFilter(value: unknown): value is TodoStatusFilter {
  return value === 'all' || value === 'active' || value === 'completed'
}

function isDueFilter(value: unknown): value is TodoDueFilter {
  return (
    value === 'all' ||
    value === 'overdue' ||
    value === 'today' ||
    value === 'next7days' ||
    value === 'upcoming' ||
    value === 'none'
  )
}

function isPriorityFilter(value: unknown): value is TodoPriorityFilter {
  return (
    value === 'all' || value === 'high' || value === 'medium' || value === 'low'
  )
}

function isPinnedFilter(value: unknown): value is TodoPinnedFilter {
  return value === 'all' || value === 'pinned' || value === 'unpinned'
}

function isCategoryFilter(value: unknown): value is TodoCategoryFilter {
  if (value === 'all' || value === 'uncategorized') {
    return true
  }
  if (typeof value !== 'string' || !value.startsWith('category:')) {
    return false
  }

  try {
    const encodedCategory = value.slice('category:'.length)
    const category = decodeURIComponent(encodedCategory)
    return (
      category.length > 0 &&
      category.length <= 30 &&
      category.trim() === category &&
      encodeURIComponent(category) === encodedCategory
    )
  } catch {
    return false
  }
}

function isSortOption(value: unknown): value is TodoSortOption {
  return (
    value === 'due' ||
    value === 'priority' ||
    value === 'updated' ||
    value === 'newest' ||
    value === 'oldest'
  )
}

export function loadTodoViewPreferences(
  storage: ReadableStorage | null = getBrowserStorage(),
): TodoViewPreferences {
  if (!storage) {
    return DEFAULT_TODO_VIEW_PREFERENCES
  }

  try {
    const storedValue = storage.getItem(TODO_VIEW_PREFERENCES_STORAGE_KEY)
    if (!storedValue) {
      return DEFAULT_TODO_VIEW_PREFERENCES
    }

    const parsed: unknown = JSON.parse(storedValue)
    if (typeof parsed !== 'object' || parsed === null) {
      return DEFAULT_TODO_VIEW_PREFERENCES
    }

    const preferences = parsed as Record<string, unknown>
    return {
      statusFilter: isStatusFilter(preferences.statusFilter)
        ? preferences.statusFilter
        : DEFAULT_TODO_VIEW_PREFERENCES.statusFilter,
      dueFilter: isDueFilter(preferences.dueFilter)
        ? preferences.dueFilter
        : DEFAULT_TODO_VIEW_PREFERENCES.dueFilter,
      priorityFilter: isPriorityFilter(preferences.priorityFilter)
        ? preferences.priorityFilter
        : DEFAULT_TODO_VIEW_PREFERENCES.priorityFilter,
      pinnedFilter: isPinnedFilter(preferences.pinnedFilter)
        ? preferences.pinnedFilter
        : DEFAULT_TODO_VIEW_PREFERENCES.pinnedFilter,
      categoryFilter: isCategoryFilter(preferences.categoryFilter)
        ? preferences.categoryFilter
        : DEFAULT_TODO_VIEW_PREFERENCES.categoryFilter,
      sortOption: isSortOption(preferences.sortOption)
        ? preferences.sortOption
        : DEFAULT_TODO_VIEW_PREFERENCES.sortOption,
    }
  } catch {
    return DEFAULT_TODO_VIEW_PREFERENCES
  }
}

export function saveTodoViewPreferences(
  preferences: TodoViewPreferences,
  storage: WritableStorage | null = getBrowserStorage(),
): boolean {
  if (!storage) {
    return false
  }

  try {
    storage.setItem(
      TODO_VIEW_PREFERENCES_STORAGE_KEY,
      JSON.stringify(preferences),
    )
    return true
  } catch {
    return false
  }
}
