export type OperationsScreen =
  | 'today-maintenance'
  | 'inspection'
  | 'attention'
  | 'work-report'
  | 'equipment'
  | 'history'

export const OPERATIONS_SCREEN_LABELS: Readonly<
  Record<OperationsScreen, string>
> = {
  'today-maintenance': '今日の保全予定',
  inspection: '定期点検',
  attention: '要対応',
  'work-report': '作業日報',
  equipment: '設備を探す',
  history: '履歴を探す',
}
