import { useCallback, useEffect, useState } from 'react'

import {
  createTodoDuplicates,
  createTodo,
  createTodos,
  deleteTodo,
  deleteTodos,
  fetchRemainingTodos,
  fetchTodos,
  updateTodoCompletion,
  updateTodoArchived,
  updateTodoDetails,
  updateTodoPinned,
  updateTodosCategory,
  updateTodosCompletion,
  updateTodosDueDate,
  updateTodosPinned,
  updateTodosPriority,
} from '../api/todos'
import { makeTodoDuplicateInput } from '../todoDuplicate'
import { makeTodoRepeatInput } from '../todoRepeat'
import type {
  Todo,
  TodoBulkCategoryResult,
  TodoBulkCompletionResult,
  TodoBulkDeleteResult,
  TodoBulkDuplicateResult,
  TodoBulkDueDateResult,
  TodoBulkImportResult,
  TodoBulkPinnedResult,
  TodoBulkPriorityResult,
  TodoCollectionState,
  TodoCreateInput,
  TodoEditInput,
  TodoPriority,
} from '../types'

const TODO_PAGE_SIZE = 50

function compareTodos(left: Todo, right: Todo): number {
  if (left.is_archived !== right.is_archived) {
    return Number(left.is_archived) - Number(right.is_archived)
  }
  if (left.is_pinned !== right.is_pinned) {
    return Number(right.is_pinned) - Number(left.is_pinned)
  }
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

function mergeTodos(
  currentItems: readonly Todo[],
  incomingItems: readonly Todo[],
): Todo[] {
  return [
    ...new Map(
      [...currentItems, ...incomingItems].map((todo) => [todo.id, todo]),
    ).values(),
  ].sort(compareTodos)
}

export function useTodos(refreshToken = 0) {
  const [state, setState] = useState<TodoCollectionState>({
    phase: 'loading',
  })
  const [isCreating, setIsCreating] = useState(false)
  const [createError, setCreateError] = useState<string | null>(null)
  const [isImporting, setIsImporting] = useState(false)
  const [importError, setImportError] = useState<string | null>(null)
  const [mutatingTodoIds, setMutatingTodoIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [todoLoadingAction, setTodoLoadingAction] = useState<
    'more' | 'all' | null
  >(null)
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null)
  const isLoadingMore = todoLoadingAction !== null

  useEffect(() => {
    const controller = new AbortController()
    void fetchTodos({ signal: controller.signal })
      .then((response) => {
        if (!controller.signal.aborted) {
          setState({
            phase: 'ready',
            items: response.items,
            total: response.total,
          })
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) {
          setState({ phase: 'error' })
        }
      })

    return () => controller.abort()
  }, [refreshToken])

  const addTodo = useCallback(
    async (input: TodoCreateInput): Promise<boolean> => {
      if (state.phase !== 'ready') {
        return false
      }

      setIsCreating(true)
      setCreateError(null)
      try {
        const created = await createTodo(input)
        setState((currentState) => {
          if (currentState.phase !== 'ready') {
            return currentState
          }

          return {
            phase: 'ready',
            items: mergeTodos(currentState.items, [created]),
            total: currentState.total + 1,
          }
        })
        return true
      } catch {
        setCreateError(
          'ToDoを追加できませんでした。APIの接続を確認してください。',
        )
        return false
      } finally {
        setIsCreating(false)
      }
    },
    [state.phase],
  )

  const reload = useCallback(() => {
    setCreateError(null)
    setImportError(null)
    setIsImporting(false)
    setMutationError(null)
    setLoadMoreError(null)
    setTodoLoadingAction(null)
    setState({ phase: 'loading' })
    void fetchTodos()
      .then((response) => {
        setState({
          phase: 'ready',
          items: response.items,
          total: response.total,
        })
      })
      .catch(() => setState({ phase: 'error' }))
  }, [])

  const clearImportError = useCallback(() => setImportError(null), [])

  const importTodos = useCallback(
    async (
      inputs: readonly TodoCreateInput[],
    ): Promise<TodoBulkImportResult> => {
      if (state.phase !== 'ready' || isImporting || inputs.length === 0) {
        return {
          createdItems: [],
          failedIndexes: inputs.map((_, index) => index),
        }
      }

      setIsImporting(true)
      setImportError(null)
      try {
        const result = await createTodos(inputs)

        setState((currentState) => {
          if (currentState.phase !== 'ready') {
            return currentState
          }

          return {
            phase: 'ready',
            items: mergeTodos(currentState.items, result.createdItems),
            total: currentState.total + result.createdItems.length,
          }
        })

        if (result.failedIndexes.length > 0) {
          const didPartiallyImport =
            result.createdItems.length > 0 ? '一部だけ登録されました。' : ''
          setImportError(
            `CSVのToDoを登録できませんでした。${didPartiallyImport}APIの接続を確認してください。`,
          )
        }

        return result
      } finally {
        setIsImporting(false)
      }
    },
    [isImporting, state.phase],
  )

  const loadMore = useCallback(async (): Promise<boolean> => {
    if (
      state.phase !== 'ready' ||
      isLoadingMore ||
      state.items.length >= state.total
    ) {
      return false
    }

    setTodoLoadingAction('more')
    setLoadMoreError(null)
    try {
      const response = await fetchTodos({
        limit: TODO_PAGE_SIZE,
        offset: state.items.length,
      })
      setState((currentState) => {
        if (currentState.phase !== 'ready') {
          return currentState
        }

        return {
          phase: 'ready',
          items: mergeTodos(currentState.items, response.items),
          total: response.total,
        }
      })
      return true
    } catch {
      setLoadMoreError(
        'ToDoを追加で読み込めませんでした。APIの接続を確認して、もう一度お試しください。',
      )
      return false
    } finally {
      setTodoLoadingAction(null)
    }
  }, [isLoadingMore, state])

  const loadAll = useCallback(async (): Promise<boolean> => {
    if (
      state.phase !== 'ready' ||
      isLoadingMore ||
      state.items.length >= state.total
    ) {
      return false
    }

    setTodoLoadingAction('all')
    setLoadMoreError(null)
    try {
      const response = await fetchRemainingTodos({
        limit: TODO_PAGE_SIZE,
        offset: state.items.length,
      })
      setState((currentState) => {
        if (currentState.phase !== 'ready') {
          return currentState
        }

        return {
          phase: 'ready',
          items: mergeTodos(currentState.items, response.items),
          total: response.total,
        }
      })
      return true
    } catch {
      setLoadMoreError(
        'ToDoをすべて読み込めませんでした。APIの接続を確認して、もう一度お試しください。',
      )
      return false
    } finally {
      setTodoLoadingAction(null)
    }
  }, [isLoadingMore, state])

  const setTodoMutationPending = useCallback(
    (todoId: string, isPending: boolean) => {
      setMutatingTodoIds((currentIds) => {
        const nextIds = new Set(currentIds)
        if (isPending) {
          nextIds.add(todoId)
        } else {
          nextIds.delete(todoId)
        }
        return nextIds
      })
    },
    [],
  )

  const toggleTodo = useCallback(
    async (todo: Todo): Promise<boolean> => {
      if (state.phase !== 'ready' || mutatingTodoIds.has(todo.id)) {
        return false
      }

      setTodoMutationPending(todo.id, true)
      setMutationError(null)
      try {
        const updated = await updateTodoCompletion(todo.id, {
          isCompleted: !todo.is_completed,
        })
        setState((currentState) => {
          if (currentState.phase !== 'ready') {
            return currentState
          }

          return {
            ...currentState,
            items: currentState.items
              .map((item) => (item.id === updated.id ? updated : item))
              .sort(compareTodos),
          }
        })
        return true
      } catch {
        setMutationError(
          '完了状態を変更できませんでした。APIの接続を確認してください。',
        )
        return false
      } finally {
        setTodoMutationPending(todo.id, false)
      }
    },
    [mutatingTodoIds, setTodoMutationPending, state.phase],
  )

  const toggleTodoPinned = useCallback(
    async (todo: Todo): Promise<boolean> => {
      if (state.phase !== 'ready' || mutatingTodoIds.has(todo.id)) {
        return false
      }

      setTodoMutationPending(todo.id, true)
      setMutationError(null)
      try {
        const updated = await updateTodoPinned(todo.id, {
          isPinned: !todo.is_pinned,
        })
        setState((currentState) => {
          if (currentState.phase !== 'ready') {
            return currentState
          }

          return {
            ...currentState,
            items: currentState.items
              .map((item) => (item.id === updated.id ? updated : item))
              .sort(compareTodos),
          }
        })
        return true
      } catch {
        setMutationError(
          '固定状態を変更できませんでした。APIの接続を確認してください。',
        )
        return false
      } finally {
        setTodoMutationPending(todo.id, false)
      }
    },
    [mutatingTodoIds, setTodoMutationPending, state.phase],
  )

  const toggleTodoArchived = useCallback(
    async (todo: Todo): Promise<boolean> => {
      if (
        state.phase !== 'ready' ||
        mutatingTodoIds.has(todo.id) ||
        (!todo.is_completed && !todo.is_archived)
      ) {
        return false
      }

      setTodoMutationPending(todo.id, true)
      setMutationError(null)
      try {
        const updated = await updateTodoArchived(todo.id, {
          isArchived: !todo.is_archived,
        })
        setState((currentState) => {
          if (currentState.phase !== 'ready') {
            return currentState
          }

          return {
            ...currentState,
            items: currentState.items
              .map((item) => (item.id === updated.id ? updated : item))
              .sort(compareTodos),
          }
        })
        return true
      } catch {
        setMutationError(
          todo.is_archived
            ? 'ToDoをアーカイブから復元できませんでした。APIの接続を確認してください。'
            : '完了ToDoをアーカイブできませんでした。APIの接続を確認してください。',
        )
        return false
      } finally {
        setTodoMutationPending(todo.id, false)
      }
    },
    [mutatingTodoIds, setTodoMutationPending, state.phase],
  )

  const setTodosCompletion = useCallback(
    async (
      todoIds: readonly string[],
      isCompleted: boolean,
    ): Promise<TodoBulkCompletionResult> => {
      if (state.phase !== 'ready') {
        return { updatedItems: [], failedIds: todoIds }
      }

      const availableTodoIds = new Set(
        state.items
          .filter(
            (todo) =>
              todoIds.includes(todo.id) &&
              todo.is_completed !== isCompleted &&
              !mutatingTodoIds.has(todo.id),
          )
          .map((todo) => todo.id),
      )
      const targetIds = [...availableTodoIds]
      if (targetIds.length === 0) {
        return { updatedItems: [], failedIds: [] }
      }

      targetIds.forEach((todoId) => setTodoMutationPending(todoId, true))
      setMutationError(null)
      try {
        const result = await updateTodosCompletion(targetIds, {
          isCompleted,
        })
        const updatedItemsById = new Map(
          result.updatedItems.map((todo) => [todo.id, todo]),
        )

        setState((currentState) => {
          if (currentState.phase !== 'ready') {
            return currentState
          }

          return {
            ...currentState,
            items: currentState.items
              .map((todo) => updatedItemsById.get(todo.id) ?? todo)
              .sort(compareTodos),
          }
        })

        if (result.failedIds.length > 0) {
          const didPartiallyUpdate =
            result.updatedItems.length > 0 ? '一部だけ保存されました。' : ''
          setMutationError(
            `選択したToDoの完了状態を変更できませんでした。${didPartiallyUpdate}APIの接続を確認してください。`,
          )
        }

        return result
      } finally {
        targetIds.forEach((todoId) => setTodoMutationPending(todoId, false))
      }
    },
    [mutatingTodoIds, setTodoMutationPending, state],
  )

  const setTodosPinned = useCallback(
    async (
      todoIds: readonly string[],
      isPinned: boolean,
    ): Promise<TodoBulkPinnedResult> => {
      if (state.phase !== 'ready') {
        return { updatedItems: [], failedIds: todoIds }
      }

      const targetIds = state.items
        .filter(
          (todo) =>
            todoIds.includes(todo.id) &&
            todo.is_pinned !== isPinned &&
            !mutatingTodoIds.has(todo.id),
        )
        .map((todo) => todo.id)
      if (targetIds.length === 0) {
        return { updatedItems: [], failedIds: [] }
      }

      targetIds.forEach((todoId) => setTodoMutationPending(todoId, true))
      setMutationError(null)
      try {
        const result = await updateTodosPinned(targetIds, { isPinned })
        const updatedItemsById = new Map(
          result.updatedItems.map((todo) => [todo.id, todo]),
        )

        setState((currentState) => {
          if (currentState.phase !== 'ready') {
            return currentState
          }

          return {
            ...currentState,
            items: currentState.items
              .map((todo) => updatedItemsById.get(todo.id) ?? todo)
              .sort(compareTodos),
          }
        })

        if (result.failedIds.length > 0) {
          const didPartiallyUpdate =
            result.updatedItems.length > 0 ? '一部だけ保存されました。' : ''
          setMutationError(
            `選択したToDoの固定状態を変更できませんでした。${didPartiallyUpdate}APIの接続を確認してください。`,
          )
        }

        return result
      } finally {
        targetIds.forEach((todoId) => setTodoMutationPending(todoId, false))
      }
    },
    [mutatingTodoIds, setTodoMutationPending, state],
  )

  const setTodosPriority = useCallback(
    async (
      todoIds: readonly string[],
      priority: TodoPriority,
    ): Promise<TodoBulkPriorityResult> => {
      if (state.phase !== 'ready') {
        return { updatedItems: [], failedIds: todoIds }
      }

      const targetTodos = state.items.filter(
        (todo) =>
          todoIds.includes(todo.id) &&
          todo.priority !== priority &&
          !mutatingTodoIds.has(todo.id),
      )
      if (targetTodos.length === 0) {
        return { updatedItems: [], failedIds: [] }
      }

      targetTodos.forEach((todo) => setTodoMutationPending(todo.id, true))
      setMutationError(null)
      try {
        const result = await updateTodosPriority(targetTodos, priority)
        const updatedItemsById = new Map(
          result.updatedItems.map((todo) => [todo.id, todo]),
        )

        setState((currentState) => {
          if (currentState.phase !== 'ready') {
            return currentState
          }

          return {
            ...currentState,
            items: currentState.items
              .map((todo) => updatedItemsById.get(todo.id) ?? todo)
              .sort(compareTodos),
          }
        })

        if (result.failedIds.length > 0) {
          const didPartiallyUpdate =
            result.updatedItems.length > 0 ? '一部だけ保存されました。' : ''
          setMutationError(
            `選択したToDoの優先度を変更できませんでした。${didPartiallyUpdate}APIの接続を確認してください。`,
          )
        }

        return result
      } finally {
        targetTodos.forEach((todo) => setTodoMutationPending(todo.id, false))
      }
    },
    [mutatingTodoIds, setTodoMutationPending, state],
  )

  const setTodosCategory = useCallback(
    async (
      todoIds: readonly string[],
      category: string,
    ): Promise<TodoBulkCategoryResult> => {
      if (state.phase !== 'ready') {
        return { updatedItems: [], failedIds: todoIds }
      }

      const targetTodos = state.items.filter(
        (todo) =>
          todoIds.includes(todo.id) &&
          (todo.category ?? '') !== category &&
          !mutatingTodoIds.has(todo.id),
      )
      if (targetTodos.length === 0) {
        return { updatedItems: [], failedIds: [] }
      }

      targetTodos.forEach((todo) => setTodoMutationPending(todo.id, true))
      setMutationError(null)
      try {
        const result = await updateTodosCategory(targetTodos, category)
        const updatedItemsById = new Map(
          result.updatedItems.map((todo) => [todo.id, todo]),
        )

        setState((currentState) => {
          if (currentState.phase !== 'ready') {
            return currentState
          }

          return {
            ...currentState,
            items: currentState.items
              .map((todo) => updatedItemsById.get(todo.id) ?? todo)
              .sort(compareTodos),
          }
        })

        if (result.failedIds.length > 0) {
          const didPartiallyUpdate =
            result.updatedItems.length > 0 ? '一部だけ保存されました。' : ''
          setMutationError(
            `選択したToDoのカテゴリを変更できませんでした。${didPartiallyUpdate}APIの接続を確認してください。`,
          )
        }

        return result
      } finally {
        targetTodos.forEach((todo) => setTodoMutationPending(todo.id, false))
      }
    },
    [mutatingTodoIds, setTodoMutationPending, state],
  )

  const setTodosDueDate = useCallback(
    async (
      todoIds: readonly string[],
      dueDate: string,
    ): Promise<TodoBulkDueDateResult> => {
      if (state.phase !== 'ready') {
        return { updatedItems: [], failedIds: todoIds }
      }

      const targetTodos = state.items.filter(
        (todo) =>
          todoIds.includes(todo.id) &&
          (todo.due_date ?? '') !== dueDate &&
          !mutatingTodoIds.has(todo.id),
      )
      if (targetTodos.length === 0) {
        return { updatedItems: [], failedIds: [] }
      }

      targetTodos.forEach((todo) => setTodoMutationPending(todo.id, true))
      setMutationError(null)
      try {
        const result = await updateTodosDueDate(targetTodos, dueDate)
        const updatedItemsById = new Map(
          result.updatedItems.map((todo) => [todo.id, todo]),
        )

        setState((currentState) => {
          if (currentState.phase !== 'ready') {
            return currentState
          }

          return {
            ...currentState,
            items: currentState.items
              .map((todo) => updatedItemsById.get(todo.id) ?? todo)
              .sort(compareTodos),
          }
        })

        if (result.failedIds.length > 0) {
          const didPartiallyUpdate =
            result.updatedItems.length > 0 ? '一部だけ保存されました。' : ''
          setMutationError(
            `選択したToDoの期限を変更できませんでした。${didPartiallyUpdate}APIの接続を確認してください。`,
          )
        }

        return result
      } finally {
        targetTodos.forEach((todo) => setTodoMutationPending(todo.id, false))
      }
    },
    [mutatingTodoIds, setTodoMutationPending, state],
  )

  const duplicateTodos = useCallback(
    async (todoIds: readonly string[]): Promise<TodoBulkDuplicateResult> => {
      if (state.phase !== 'ready') {
        return { createdItems: [], failedIds: todoIds }
      }

      const targetTodos = state.items.filter(
        (todo) => todoIds.includes(todo.id) && !mutatingTodoIds.has(todo.id),
      )
      if (targetTodos.length === 0) {
        return { createdItems: [], failedIds: [] }
      }

      targetTodos.forEach((todo) => setTodoMutationPending(todo.id, true))
      setMutationError(null)
      try {
        const result = await createTodoDuplicates(targetTodos)

        setState((currentState) => {
          if (currentState.phase !== 'ready') {
            return currentState
          }

          return {
            phase: 'ready',
            items: mergeTodos(currentState.items, result.createdItems),
            total: currentState.total + result.createdItems.length,
          }
        })

        if (result.failedIds.length > 0) {
          const didPartiallyDuplicate =
            result.createdItems.length > 0 ? '一部だけ複製されました。' : ''
          setMutationError(
            `選択したToDoを複製できませんでした。${didPartiallyDuplicate}APIの接続を確認してください。`,
          )
        }

        return result
      } finally {
        targetTodos.forEach((todo) => setTodoMutationPending(todo.id, false))
      }
    },
    [mutatingTodoIds, setTodoMutationPending, state],
  )

  const removeTodos = useCallback(
    async (todoIds: readonly string[]): Promise<TodoBulkDeleteResult> => {
      if (state.phase !== 'ready') {
        return { deletedIds: [], failedIds: todoIds }
      }

      const availableTodoIds = new Set(
        state.items
          .filter(
            (todo) =>
              todoIds.includes(todo.id) && !mutatingTodoIds.has(todo.id),
          )
          .map((todo) => todo.id),
      )
      const targetIds = [...availableTodoIds]
      if (targetIds.length === 0) {
        return { deletedIds: [], failedIds: [] }
      }

      targetIds.forEach((todoId) => setTodoMutationPending(todoId, true))
      setMutationError(null)
      try {
        const result = await deleteTodos(targetIds)
        const deletedIdSet = new Set(result.deletedIds)

        setState((currentState) => {
          if (currentState.phase !== 'ready') {
            return currentState
          }

          return {
            phase: 'ready',
            items: currentState.items.filter(
              (todo) => !deletedIdSet.has(todo.id),
            ),
            total: Math.max(0, currentState.total - result.deletedIds.length),
          }
        })

        if (result.failedIds.length > 0) {
          const didPartiallyDelete =
            result.deletedIds.length > 0 ? '一部だけ削除されました。' : ''
          setMutationError(
            `選択したToDoを削除できませんでした。${didPartiallyDelete}APIの接続を確認してください。`,
          )
        }

        return result
      } finally {
        targetIds.forEach((todoId) => setTodoMutationPending(todoId, false))
      }
    },
    [mutatingTodoIds, setTodoMutationPending, state],
  )

  const removeTodo = useCallback(
    async (todoId: string): Promise<boolean> => {
      if (state.phase !== 'ready' || mutatingTodoIds.has(todoId)) {
        return false
      }

      setTodoMutationPending(todoId, true)
      setMutationError(null)
      try {
        await deleteTodo(todoId)
        setState((currentState) => {
          if (currentState.phase !== 'ready') {
            return currentState
          }

          return {
            phase: 'ready',
            items: currentState.items.filter((item) => item.id !== todoId),
            total: Math.max(0, currentState.total - 1),
          }
        })
        return true
      } catch {
        setMutationError(
          'ToDoを削除できませんでした。APIの接続を確認してください。',
        )
        return false
      } finally {
        setTodoMutationPending(todoId, false)
      }
    },
    [mutatingTodoIds, setTodoMutationPending, state.phase],
  )

  const editTodo = useCallback(
    async (todoId: string, input: TodoEditInput): Promise<boolean> => {
      if (state.phase !== 'ready' || mutatingTodoIds.has(todoId)) {
        return false
      }

      setTodoMutationPending(todoId, true)
      setMutationError(null)
      try {
        const updated = await updateTodoDetails(todoId, input)
        setState((currentState) => {
          if (currentState.phase !== 'ready') {
            return currentState
          }

          return {
            ...currentState,
            items: currentState.items
              .map((item) => (item.id === updated.id ? updated : item))
              .sort(compareTodos),
          }
        })
        return true
      } catch {
        setMutationError(
          'ToDoを編集できませんでした。入力内容とAPIの接続を確認してください。',
        )
        return false
      } finally {
        setTodoMutationPending(todoId, false)
      }
    },
    [mutatingTodoIds, setTodoMutationPending, state.phase],
  )

  const duplicateTodo = useCallback(
    async (todo: Todo): Promise<boolean> => {
      if (state.phase !== 'ready' || mutatingTodoIds.has(todo.id)) {
        return false
      }

      setTodoMutationPending(todo.id, true)
      setMutationError(null)
      try {
        const created = await createTodo(makeTodoDuplicateInput(todo))
        setState((currentState) => {
          if (currentState.phase !== 'ready') {
            return currentState
          }

          return {
            phase: 'ready',
            items: mergeTodos(currentState.items, [created]),
            total: currentState.total + 1,
          }
        })
        return true
      } catch {
        setMutationError(
          'ToDoを複製できませんでした。APIの接続を確認してください。',
        )
        return false
      } finally {
        setTodoMutationPending(todo.id, false)
      }
    },
    [mutatingTodoIds, setTodoMutationPending, state.phase],
  )

  const repeatTodo = useCallback(
    async (todo: Todo, dueDate: string): Promise<boolean> => {
      if (state.phase !== 'ready' || mutatingTodoIds.has(todo.id)) {
        return false
      }

      setTodoMutationPending(todo.id, true)
      setMutationError(null)
      try {
        const created = await createTodo(makeTodoRepeatInput(todo, dueDate))
        setState((currentState) => {
          if (currentState.phase !== 'ready') {
            return currentState
          }

          return {
            phase: 'ready',
            items: mergeTodos(currentState.items, [created]),
            total: currentState.total + 1,
          }
        })
        return true
      } catch {
        setMutationError(
          '次回ToDoを作成できませんでした。APIの接続を確認してください。',
        )
        return false
      } finally {
        setTodoMutationPending(todo.id, false)
      }
    },
    [mutatingTodoIds, setTodoMutationPending, state.phase],
  )

  return {
    state,
    isCreating,
    createError,
    isImporting,
    importError,
    mutationError,
    isLoadingMore,
    todoLoadingAction,
    loadMoreError,
    mutatingTodoIds,
    addTodo,
    importTodos,
    clearImportError,
    editTodo,
    duplicateTodo,
    repeatTodo,
    toggleTodo,
    toggleTodoPinned,
    toggleTodoArchived,
    setTodosCompletion,
    setTodosPinned,
    setTodosPriority,
    setTodosCategory,
    setTodosDueDate,
    duplicateTodos,
    removeTodos,
    removeTodo,
    loadMore,
    loadAll,
    reload,
  }
}
