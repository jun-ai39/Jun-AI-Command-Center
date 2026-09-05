import { authenticatedFetch } from '../../auth/api/authenticatedFetch'
import type {
  Todo,
  TodoArchivedInput,
  TodoBulkCategoryResult,
  TodoBulkCompletionResult,
  TodoBulkDeleteResult,
  TodoBulkDuplicateResult,
  TodoBulkDueDateResult,
  TodoBulkImportResult,
  TodoBulkPinnedResult,
  TodoBulkPriorityResult,
  TodoCompletionInput,
  TodoCreateInput,
  TodoDueSummaryResponse,
  TodoEditInput,
  TodoListResponse,
  TodoPinnedInput,
  TodoPriority,
} from '../types'
import { makeTodoDuplicateInput } from '../todoDuplicate'

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'
const DATE_INPUT_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

type TodoRequestOptions = {
  readonly baseUrl?: string
  readonly signal?: AbortSignal
  readonly limit?: number
  readonly offset?: number
}

export class TodoApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TodoApiError'
  }
}

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  return configuredUrl || DEFAULT_API_BASE_URL
}

function removeTrailingSlash(url: string): string {
  return url.replace(/\/$/, '')
}

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === 'string'
}

function isTodoPriority(value: unknown): value is TodoPriority {
  return value === 'high' || value === 'medium' || value === 'low'
}

function isTodo(value: unknown): value is Todo {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.title === 'string' &&
    isNullableString(record.description) &&
    isNullableString(record.due_date) &&
    isTodoPriority(record.priority) &&
    isNullableString(record.category) &&
    isNullableString(record.equipment_id) &&
    typeof record.is_pinned === 'boolean' &&
    typeof record.is_completed === 'boolean' &&
    typeof record.is_archived === 'boolean' &&
    typeof record.created_at === 'string' &&
    typeof record.updated_at === 'string'
  )
}

function isIsoDate(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const match = DATE_INPUT_PATTERN.exec(value)
  if (!match) return false
  const candidate = new Date(
    Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])),
  )
  return (
    candidate.getUTCFullYear() === Number(match[1]) &&
    candidate.getUTCMonth() === Number(match[2]) - 1 &&
    candidate.getUTCDate() === Number(match[3])
  )
}

function isTodoDueSummaryResponse(
  value: unknown,
  requestedDate: string,
): value is TodoDueSummaryResponse {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  if (
    record.target_date !== requestedDate ||
    !Array.isArray(record.today_items) ||
    !Array.isArray(record.overdue_items) ||
    !record.today_items.every(isTodo) ||
    !record.overdue_items.every(isTodo)
  ) {
    return false
  }
  const todayItems = record.today_items as Todo[]
  const overdueItems = record.overdue_items as Todo[]
  const allItems = [...overdueItems, ...todayItems]
  return (
    todayItems.every(
      (todo) =>
        todo.due_date === requestedDate &&
        !todo.is_completed &&
        !todo.is_archived,
    ) &&
    overdueItems.every(
      (todo) =>
        isIsoDate(todo.due_date) &&
        todo.due_date < requestedDate &&
        !todo.is_completed &&
        !todo.is_archived,
    ) &&
    new Set(allItems.map((todo) => todo.id)).size === allItems.length
  )
}

function isTodoListResponse(value: unknown): value is TodoListResponse {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    Array.isArray(record.items) &&
    record.items.every(isTodo) &&
    Number.isInteger(record.total) &&
    Number(record.total) >= 0 &&
    Number.isInteger(record.limit) &&
    Number(record.limit) >= 1 &&
    Number(record.limit) <= 100 &&
    Number.isInteger(record.offset) &&
    Number(record.offset) >= 0
  )
}

function getTodosUrl(
  baseUrl?: string,
  pagination: Pick<TodoRequestOptions, 'limit' | 'offset'> = {},
): string {
  const url = `${removeTrailingSlash(baseUrl ?? getApiBaseUrl())}/todos`
  const searchParams = new URLSearchParams()

  if (pagination.limit !== undefined) {
    searchParams.set('limit', String(pagination.limit))
  }
  if (pagination.offset !== undefined) {
    searchParams.set('offset', String(pagination.offset))
  }

  const query = searchParams.toString()
  return query ? `${url}?${query}` : url
}

function getTodoUrl(todoId: string, baseUrl?: string): string {
  return `${getTodosUrl(baseUrl)}/${encodeURIComponent(todoId)}`
}

export async function fetchTodos(
  options: TodoRequestOptions = {},
): Promise<TodoListResponse> {
  const response = await authenticatedFetch(
    getTodosUrl(options.baseUrl, options),
    {
      headers: { Accept: 'application/json' },
      signal: options.signal,
    },
  )

  if (!response.ok) {
    throw new TodoApiError(`ToDo API returned HTTP ${response.status}`)
  }

  const payload: unknown = await response.json()
  if (!isTodoListResponse(payload)) {
    throw new TodoApiError('ToDo API returned an invalid list response')
  }

  return payload
}

export async function fetchTodoDueSummary(
  targetDate: string,
  options: TodoRequestOptions = {},
): Promise<TodoDueSummaryResponse> {
  if (!isIsoDate(targetDate)) {
    throw new TodoApiError('ToDo due summary date is invalid')
  }
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const query = new URLSearchParams({ target_date: targetDate })
  const response = await authenticatedFetch(
    `${baseUrl}/todos/due-summary?${query}`,
    {
      headers: { Accept: 'application/json' },
      signal: options.signal,
    },
  )
  if (!response.ok) {
    throw new TodoApiError(`ToDo API returned HTTP ${response.status}`)
  }
  const payload: unknown = await response.json()
  if (!isTodoDueSummaryResponse(payload, targetDate)) {
    throw new TodoApiError('ToDo API returned an invalid due summary response')
  }
  return payload
}

export async function fetchRemainingTodos(
  options: TodoRequestOptions = {},
): Promise<{ readonly items: readonly Todo[]; readonly total: number }> {
  const pageLimit = options.limit ?? 50
  let nextOffset = options.offset ?? 0
  let total: number
  const items: Todo[] = []

  do {
    const response = await fetchTodos({
      ...options,
      limit: pageLimit,
      offset: nextOffset,
    })
    total = response.total

    if (response.items.length === 0) {
      if (nextOffset < total) {
        throw new TodoApiError(
          'ToDo API returned an empty page before the collection ended',
        )
      }
      break
    }

    items.push(...response.items)
    nextOffset += response.items.length
  } while (nextOffset < total)

  return { items, total }
}

export async function createTodo(
  input: TodoCreateInput,
  options: TodoRequestOptions = {},
): Promise<Todo> {
  const normalizedDescription = input.description.trim()
  const normalizedCategory = input.category.trim()
  const response = await authenticatedFetch(getTodosUrl(options.baseUrl), {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title: input.title.trim(),
      description: normalizedDescription || null,
      due_date: input.dueDate || null,
      priority: input.priority,
      category: normalizedCategory || null,
      equipment_id: input.equipmentId?.trim() || null,
      ...(input.isCompleted === undefined
        ? {}
        : { is_completed: input.isCompleted }),
      ...(input.isPinned === undefined ? {} : { is_pinned: input.isPinned }),
    }),
    signal: options.signal,
  })

  if (!response.ok) {
    throw new TodoApiError(`ToDo API returned HTTP ${response.status}`)
  }

  const payload: unknown = await response.json()
  if (!isTodo(payload)) {
    throw new TodoApiError('ToDo API returned an invalid item response')
  }

  return payload
}

export async function createTodos(
  inputs: readonly TodoCreateInput[],
  options: TodoRequestOptions = {},
): Promise<TodoBulkImportResult> {
  const createdItems: Todo[] = []
  const failedIndexes: number[] = []

  for (const [index, input] of inputs.entries()) {
    try {
      createdItems.push(await createTodo(input, options))
    } catch {
      failedIndexes.push(index)
    }
  }

  return { createdItems, failedIndexes }
}

export async function createTodoDuplicates(
  todos: readonly Todo[],
  options: TodoRequestOptions = {},
): Promise<TodoBulkDuplicateResult> {
  const uniqueTodos = [
    ...new Map(todos.map((todo) => [todo.id, todo])).values(),
  ]
  const results = await Promise.allSettled(
    uniqueTodos.map((todo) =>
      createTodo(makeTodoDuplicateInput(todo), options),
    ),
  )

  const createdItems: Todo[] = []
  const failedIds: string[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      createdItems.push(result.value)
    } else {
      failedIds.push(uniqueTodos[index].id)
    }
  })

  return { createdItems, failedIds }
}

export async function updateTodoCompletion(
  todoId: string,
  input: TodoCompletionInput,
  options: TodoRequestOptions = {},
): Promise<Todo> {
  const response = await authenticatedFetch(
    getTodoUrl(todoId, options.baseUrl),
    {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ is_completed: input.isCompleted }),
      signal: options.signal,
    },
  )

  if (!response.ok) {
    throw new TodoApiError(`ToDo API returned HTTP ${response.status}`)
  }

  const payload: unknown = await response.json()
  if (!isTodo(payload)) {
    throw new TodoApiError('ToDo API returned an invalid item response')
  }

  return payload
}

export async function updateTodoPinned(
  todoId: string,
  input: TodoPinnedInput,
  options: TodoRequestOptions = {},
): Promise<Todo> {
  const response = await authenticatedFetch(
    getTodoUrl(todoId, options.baseUrl),
    {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ is_pinned: input.isPinned }),
      signal: options.signal,
    },
  )

  if (!response.ok) {
    throw new TodoApiError(`ToDo API returned HTTP ${response.status}`)
  }

  const payload: unknown = await response.json()
  if (!isTodo(payload)) {
    throw new TodoApiError('ToDo API returned an invalid item response')
  }

  return payload
}

export async function updateTodoArchived(
  todoId: string,
  input: TodoArchivedInput,
  options: TodoRequestOptions = {},
): Promise<Todo> {
  const response = await authenticatedFetch(
    getTodoUrl(todoId, options.baseUrl),
    {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ is_archived: input.isArchived }),
      signal: options.signal,
    },
  )

  if (!response.ok) {
    throw new TodoApiError(`ToDo API returned HTTP ${response.status}`)
  }

  const payload: unknown = await response.json()
  if (!isTodo(payload)) {
    throw new TodoApiError('ToDo API returned an invalid item response')
  }

  return payload
}

export async function updateTodosPinned(
  todoIds: readonly string[],
  input: TodoPinnedInput,
  options: TodoRequestOptions = {},
): Promise<TodoBulkPinnedResult> {
  const uniqueTodoIds = [...new Set(todoIds)]
  const results = await Promise.allSettled(
    uniqueTodoIds.map((todoId) => updateTodoPinned(todoId, input, options)),
  )

  const updatedItems: Todo[] = []
  const failedIds: string[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      updatedItems.push(result.value)
    } else {
      failedIds.push(uniqueTodoIds[index])
    }
  })

  return { updatedItems, failedIds }
}

export async function updateTodosCompletion(
  todoIds: readonly string[],
  input: TodoCompletionInput,
  options: TodoRequestOptions = {},
): Promise<TodoBulkCompletionResult> {
  const uniqueTodoIds = [...new Set(todoIds)]
  const results = await Promise.allSettled(
    uniqueTodoIds.map((todoId) => updateTodoCompletion(todoId, input, options)),
  )

  const updatedItems: Todo[] = []
  const failedIds: string[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      updatedItems.push(result.value)
    } else {
      failedIds.push(uniqueTodoIds[index])
    }
  })

  return { updatedItems, failedIds }
}

export async function updateTodosPriority(
  todos: readonly Todo[],
  priority: TodoPriority,
  options: TodoRequestOptions = {},
): Promise<TodoBulkPriorityResult> {
  const uniqueTodos = [
    ...new Map(todos.map((todo) => [todo.id, todo])).values(),
  ]
  const results = await Promise.allSettled(
    uniqueTodos.map((todo) =>
      updateTodoDetails(
        todo.id,
        {
          title: todo.title,
          description: todo.description ?? '',
          dueDate: todo.due_date ?? '',
          priority,
          category: todo.category ?? '',
          equipmentId: todo.equipment_id ?? '',
        },
        options,
      ),
    ),
  )

  const updatedItems: Todo[] = []
  const failedIds: string[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      updatedItems.push(result.value)
    } else {
      failedIds.push(uniqueTodos[index].id)
    }
  })

  return { updatedItems, failedIds }
}

export async function updateTodosCategory(
  todos: readonly Todo[],
  category: string,
  options: TodoRequestOptions = {},
): Promise<TodoBulkCategoryResult> {
  const uniqueTodos = [
    ...new Map(todos.map((todo) => [todo.id, todo])).values(),
  ]
  const results = await Promise.allSettled(
    uniqueTodos.map((todo) =>
      updateTodoDetails(
        todo.id,
        {
          title: todo.title,
          description: todo.description ?? '',
          dueDate: todo.due_date ?? '',
          priority: todo.priority,
          category,
          equipmentId: todo.equipment_id ?? '',
        },
        options,
      ),
    ),
  )

  const updatedItems: Todo[] = []
  const failedIds: string[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      updatedItems.push(result.value)
    } else {
      failedIds.push(uniqueTodos[index].id)
    }
  })

  return { updatedItems, failedIds }
}

export async function updateTodosDueDate(
  todos: readonly Todo[],
  dueDate: string,
  options: TodoRequestOptions = {},
): Promise<TodoBulkDueDateResult> {
  const uniqueTodos = [
    ...new Map(todos.map((todo) => [todo.id, todo])).values(),
  ]
  const results = await Promise.allSettled(
    uniqueTodos.map((todo) =>
      updateTodoDetails(
        todo.id,
        {
          title: todo.title,
          description: todo.description ?? '',
          dueDate,
          priority: todo.priority,
          category: todo.category ?? '',
          equipmentId: todo.equipment_id ?? '',
        },
        options,
      ),
    ),
  )

  const updatedItems: Todo[] = []
  const failedIds: string[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      updatedItems.push(result.value)
    } else {
      failedIds.push(uniqueTodos[index].id)
    }
  })

  return { updatedItems, failedIds }
}

export async function updateTodoDetails(
  todoId: string,
  input: TodoEditInput,
  options: TodoRequestOptions = {},
): Promise<Todo> {
  const normalizedDescription = input.description.trim()
  const normalizedCategory = input.category.trim()
  const response = await authenticatedFetch(
    getTodoUrl(todoId, options.baseUrl),
    {
      method: 'PATCH',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        title: input.title.trim(),
        description: normalizedDescription || null,
        due_date: input.dueDate || null,
        priority: input.priority,
        category: normalizedCategory || null,
        equipment_id: input.equipmentId.trim() || null,
      }),
      signal: options.signal,
    },
  )

  if (!response.ok) {
    throw new TodoApiError(`ToDo API returned HTTP ${response.status}`)
  }

  const payload: unknown = await response.json()
  if (!isTodo(payload)) {
    throw new TodoApiError('ToDo API returned an invalid item response')
  }

  return payload
}

export async function deleteTodo(
  todoId: string,
  options: TodoRequestOptions = {},
): Promise<void> {
  const response = await authenticatedFetch(
    getTodoUrl(todoId, options.baseUrl),
    {
      method: 'DELETE',
      headers: { Accept: 'application/json' },
      signal: options.signal,
    },
  )

  if (!response.ok) {
    throw new TodoApiError(`ToDo API returned HTTP ${response.status}`)
  }

  if (response.status !== 204) {
    throw new TodoApiError('ToDo API returned an invalid delete response')
  }
}

export async function deleteTodos(
  todoIds: readonly string[],
  options: TodoRequestOptions = {},
): Promise<TodoBulkDeleteResult> {
  const uniqueTodoIds = [...new Set(todoIds)]
  const results = await Promise.allSettled(
    uniqueTodoIds.map((todoId) => deleteTodo(todoId, options)),
  )

  const deletedIds: string[] = []
  const failedIds: string[] = []

  results.forEach((result, index) => {
    if (result.status === 'fulfilled') {
      deletedIds.push(uniqueTodoIds[index])
    } else {
      failedIds.push(uniqueTodoIds[index])
    }
  })

  return { deletedIds, failedIds }
}
