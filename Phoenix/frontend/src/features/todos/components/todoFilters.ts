import type { Todo, TodoPriority } from '../types'
import { addDaysToLocalDateString } from '../todoDueDate'

export type TodoStatusFilter = 'all' | 'active' | 'completed'
export type TodoDueFilter =
  'all' | 'overdue' | 'today' | 'next7days' | 'upcoming' | 'none'
export type TodoDueState =
  'overdue' | 'today' | 'upcoming' | 'none' | 'completed'
export type TodoPriorityFilter = 'all' | TodoPriority
export type TodoPinnedFilter = 'all' | 'pinned' | 'unpinned'
export type TodoCategoryFilter = 'all' | 'uncategorized' | `category:${string}`
export type TodoCategoryFilterOption = {
  readonly value: TodoCategoryFilter
  readonly label: string
}
export type TodoSortOption =
  'due' | 'priority' | 'updated' | 'newest' | 'oldest'
export type TodoAttentionCounts = {
  readonly overdue: number
  readonly today: number
  readonly highPriority: number
}
export type TodoProgressSummary = {
  readonly total: number
  readonly active: number
  readonly completed: number
  readonly completionRate: number
}
export type TodoViewSettings = {
  readonly query: string
  readonly statusFilter: TodoStatusFilter
  readonly dueFilter: TodoDueFilter
  readonly priorityFilter: TodoPriorityFilter
  readonly pinnedFilter: TodoPinnedFilter
  readonly categoryFilter: TodoCategoryFilter
  readonly sortOption: TodoSortOption
}

const TODO_PRIORITY_ORDER = { high: 0, medium: 1, low: 2 } as const

export function getLocalDateString(now: Date = new Date()): string {
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getTodoDueState(
  todo: Todo,
  today: string = getLocalDateString(),
): TodoDueState {
  if (todo.is_completed) {
    return 'completed'
  }
  if (todo.due_date === null) {
    return 'none'
  }
  if (todo.due_date < today) {
    return 'overdue'
  }
  if (todo.due_date === today) {
    return 'today'
  }
  return 'upcoming'
}

export function getTodoAttentionCounts(
  todos: readonly Todo[],
  today: string = getLocalDateString(),
): TodoAttentionCounts {
  return todos.reduce<TodoAttentionCounts>(
    (counts, todo) => {
      if (todo.is_completed) {
        return counts
      }

      const dueState = getTodoDueState(todo, today)
      return {
        overdue: counts.overdue + Number(dueState === 'overdue'),
        today: counts.today + Number(dueState === 'today'),
        highPriority: counts.highPriority + Number(todo.priority === 'high'),
      }
    },
    { overdue: 0, today: 0, highPriority: 0 },
  )
}

export function getTodoProgressSummary(
  todos: readonly Todo[],
): TodoProgressSummary {
  const completed = todos.filter((todo) => todo.is_completed).length
  const total = todos.length

  return {
    total,
    active: total - completed,
    completed,
    completionRate: total === 0 ? 0 : Math.round((completed / total) * 100),
  }
}

function normalizeSearchValue(value: string): string {
  return value.normalize('NFKC').trim().toLocaleLowerCase('ja-JP')
}

export function getTodoViewChangeCount(settings: TodoViewSettings): number {
  return [
    normalizeSearchValue(settings.query) !== '',
    settings.statusFilter !== 'all',
    settings.dueFilter !== 'all',
    settings.priorityFilter !== 'all',
    settings.pinnedFilter !== 'all',
    settings.categoryFilter !== 'all',
    settings.sortOption !== 'due',
  ].filter(Boolean).length
}

export function makeTodoCategoryFilter(category: string): TodoCategoryFilter {
  return `category:${encodeURIComponent(category)}`
}

export function getTodoCategoryFilterOptions(
  todos: readonly Todo[],
): readonly TodoCategoryFilterOption[] {
  const categories = [
    ...new Set(
      todos
        .map((todo) => todo.category)
        .filter((category): category is string => category !== null),
    ),
  ].sort((left, right) => left.localeCompare(right, 'ja-JP'))

  return [
    { value: 'all', label: 'すべて' },
    { value: 'uncategorized', label: 'カテゴリなし' },
    ...categories.map((category) => ({
      value: makeTodoCategoryFilter(category),
      label: category,
    })),
  ]
}

export function filterTodos(
  todos: readonly Todo[],
  query: string,
  statusFilter: TodoStatusFilter,
  dueFilter: TodoDueFilter = 'all',
  today: string = getLocalDateString(),
  priorityFilter: TodoPriorityFilter = 'all',
  categoryFilter: TodoCategoryFilter = 'all',
  pinnedFilter: TodoPinnedFilter = 'all',
): readonly Todo[] {
  const normalizedQuery = normalizeSearchValue(query)
  const sevenDaysLater = addDaysToLocalDateString(today, 7)

  return todos.filter((todo) => {
    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'completed' && todo.is_completed) ||
      (statusFilter === 'active' && !todo.is_completed)
    const matchesDueDate =
      dueFilter === 'all' ||
      (dueFilter === 'next7days'
        ? !todo.is_completed &&
          todo.due_date !== null &&
          todo.due_date >= today &&
          todo.due_date <= sevenDaysLater
        : getTodoDueState(todo, today) === dueFilter)
    const matchesPriority =
      priorityFilter === 'all' || todo.priority === priorityFilter
    const matchesPinned =
      pinnedFilter === 'all' ||
      (pinnedFilter === 'pinned' && todo.is_pinned) ||
      (pinnedFilter === 'unpinned' && !todo.is_pinned)
    const matchesCategory =
      categoryFilter === 'all' ||
      (categoryFilter === 'uncategorized' && todo.category === null) ||
      (todo.category !== null &&
        categoryFilter === makeTodoCategoryFilter(todo.category))
    if (
      !matchesStatus ||
      !matchesDueDate ||
      !matchesPriority ||
      !matchesPinned ||
      !matchesCategory ||
      !normalizedQuery
    ) {
      return (
        matchesStatus &&
        matchesDueDate &&
        matchesPriority &&
        matchesPinned &&
        matchesCategory
      )
    }

    const searchableText = normalizeSearchValue(
      `${todo.title} ${todo.description ?? ''} ${todo.category ?? ''}`,
    )
    return searchableText.includes(normalizedQuery)
  })
}

function compareByDueDate(left: Todo, right: Todo): number {
  if (left.is_completed !== right.is_completed) {
    return Number(left.is_completed) - Number(right.is_completed)
  }
  if (left.due_date === null && right.due_date !== null) {
    return 1
  }
  if (left.due_date !== null && right.due_date === null) {
    return -1
  }

  const dueDateOrder = (left.due_date ?? '').localeCompare(right.due_date ?? '')
  if (dueDateOrder !== 0) {
    return dueDateOrder
  }

  const creationOrder = left.created_at.localeCompare(right.created_at)
  return creationOrder !== 0 ? creationOrder : left.id.localeCompare(right.id)
}

function compareByPriority(left: Todo, right: Todo): number {
  if (left.is_completed !== right.is_completed) {
    return Number(left.is_completed) - Number(right.is_completed)
  }

  const priorityOrder =
    TODO_PRIORITY_ORDER[left.priority] - TODO_PRIORITY_ORDER[right.priority]
  return priorityOrder !== 0 ? priorityOrder : compareByDueDate(left, right)
}

export function sortTodos(
  todos: readonly Todo[],
  sortOption: TodoSortOption,
): readonly Todo[] {
  return [...todos].sort((left, right) => {
    if (left.is_pinned !== right.is_pinned) {
      return Number(right.is_pinned) - Number(left.is_pinned)
    }
    if (sortOption === 'due') {
      return compareByDueDate(left, right)
    }
    if (sortOption === 'priority') {
      return compareByPriority(left, right)
    }
    if (sortOption === 'updated') {
      const updateOrder = right.updated_at.localeCompare(left.updated_at)
      if (updateOrder !== 0) {
        return updateOrder
      }

      const creationOrder = right.created_at.localeCompare(left.created_at)
      return creationOrder !== 0
        ? creationOrder
        : left.id.localeCompare(right.id)
    }

    const creationOrder = left.created_at.localeCompare(right.created_at)
    const orderedCreation =
      sortOption === 'newest' ? -creationOrder : creationOrder
    return orderedCreation !== 0
      ? orderedCreation
      : left.id.localeCompare(right.id)
  })
}
