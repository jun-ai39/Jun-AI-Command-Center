import { useCallback, useEffect, useState } from 'react'

import { getLocalDateInputValue } from '../../work-reports/workReportForm'
import { fetchTodoDueSummary, updateTodoCompletion } from '../api/todos'
import type { Todo, TodoDueSummaryState } from '../types'

type TodayMaintenanceScheduleActions = {
  readonly targetDate: string
  readonly state: TodoDueSummaryState
  readonly mutatingTodoIds: ReadonlySet<string>
  readonly mutationError: string | null
  readonly completeSchedule: (todo: Todo) => Promise<boolean>
  readonly reload: () => void
}

export function useTodayMaintenanceSchedules(
  onScheduleCompleted?: () => void,
): TodayMaintenanceScheduleActions {
  const targetDate = getLocalDateInputValue()
  const [state, setState] = useState<TodoDueSummaryState>({ phase: 'loading' })
  const [reloadToken, setReloadToken] = useState(0)
  const [mutatingTodoIds, setMutatingTodoIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  )
  const [mutationError, setMutationError] = useState<string | null>(null)

  useEffect(() => {
    const controller = new AbortController()
    void fetchTodoDueSummary(targetDate, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted) setState({ phase: 'ready', data })
      })
      .catch(() => {
        if (!controller.signal.aborted) setState({ phase: 'error' })
      })
    return () => controller.abort()
  }, [reloadToken, targetDate])

  const reload = useCallback(() => {
    setMutationError(null)
    setState({ phase: 'loading' })
    setReloadToken((current) => current + 1)
  }, [])

  const completeSchedule = useCallback(
    async (todo: Todo): Promise<boolean> => {
      if (state.phase !== 'ready' || mutatingTodoIds.has(todo.id)) return false
      setMutatingTodoIds((current) => new Set(current).add(todo.id))
      setMutationError(null)
      try {
        const updated = await updateTodoCompletion(todo.id, {
          isCompleted: true,
        })
        if (!updated.is_completed) throw new Error('Completion was not saved')
        setState((current) => {
          if (current.phase !== 'ready') return current
          return {
            phase: 'ready',
            data: {
              ...current.data,
              today_items: current.data.today_items.filter(
                (item) => item.id !== updated.id,
              ),
              overdue_items: current.data.overdue_items.filter(
                (item) => item.id !== updated.id,
              ),
            },
          }
        })
        onScheduleCompleted?.()
        return true
      } catch {
        setMutationError(
          '保全予定を完了にできませんでした。APIの接続を確認してください。',
        )
        return false
      } finally {
        setMutatingTodoIds((current) => {
          const next = new Set(current)
          next.delete(todo.id)
          return next
        })
      }
    },
    [mutatingTodoIds, onScheduleCompleted, state.phase],
  )

  return {
    targetDate,
    state,
    mutatingTodoIds,
    mutationError,
    completeSchedule,
    reload,
  }
}
