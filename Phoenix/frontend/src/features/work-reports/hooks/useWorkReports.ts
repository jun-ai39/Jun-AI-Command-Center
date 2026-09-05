import { useCallback, useEffect, useState } from 'react'

import { fetchWorkReports } from '../api/workReports'
import type {
  WorkReportCollectionState,
  WorkReportSearchFilters,
} from '../types'

const EMPTY_SEARCH_FILTERS: WorkReportSearchFilters = {
  workDate: null,
  departmentId: null,
  workContentQuery: null,
  progress: null,
}

type WorkReportCollectionActions = {
  readonly state: WorkReportCollectionState
  readonly activeFilters: WorkReportSearchFilters
  readonly search: (filters: WorkReportSearchFilters) => void
  readonly clearSearch: () => void
  readonly reload: () => void
}

export function useWorkReports(
  refreshToken: number,
): WorkReportCollectionActions {
  const [state, setState] = useState<WorkReportCollectionState>({
    phase: 'loading',
  })
  const [reloadToken, setReloadToken] = useState(0)
  const [activeFilters, setActiveFilters] =
    useState<WorkReportSearchFilters>(EMPTY_SEARCH_FILTERS)

  useEffect(() => {
    const controller = new AbortController()
    void fetchWorkReports({
      limit: 5,
      offset: 0,
      workDate: activeFilters.workDate ?? undefined,
      departmentId: activeFilters.departmentId ?? undefined,
      workContentQuery: activeFilters.workContentQuery ?? undefined,
      progress: activeFilters.progress ?? undefined,
      signal: controller.signal,
    })
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
        if (!controller.signal.aborted) setState({ phase: 'error' })
      })

    return () => controller.abort()
  }, [activeFilters, refreshToken, reloadToken])

  const search = useCallback((filters: WorkReportSearchFilters) => {
    setState({ phase: 'loading' })
    setActiveFilters(filters)
    setReloadToken((current) => current + 1)
  }, [])

  const clearSearch = useCallback(() => {
    setState({ phase: 'loading' })
    setActiveFilters(EMPTY_SEARCH_FILTERS)
    setReloadToken((current) => current + 1)
  }, [])

  const reload = useCallback(() => {
    setState({ phase: 'loading' })
    setReloadToken((current) => current + 1)
  }, [])

  return {
    state,
    activeFilters,
    search,
    clearSearch,
    reload,
  }
}
