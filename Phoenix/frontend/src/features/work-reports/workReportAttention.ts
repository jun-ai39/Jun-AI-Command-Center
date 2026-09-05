import type {
  WorkReportAttentionProgress,
  WorkReportSearchFilters,
} from './types'

export function createAttentionProgressSearchFilters(
  progress: WorkReportAttentionProgress,
): WorkReportSearchFilters {
  return {
    workDate: null,
    departmentId: null,
    workContentQuery: null,
    progress,
  }
}
