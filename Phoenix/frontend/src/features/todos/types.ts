export type TodoPriority = 'high' | 'medium' | 'low'

export type Todo = {
  readonly id: string
  readonly title: string
  readonly description: string | null
  readonly due_date: string | null
  readonly priority: TodoPriority
  readonly category: string | null
  readonly equipment_id: string | null
  readonly is_pinned: boolean
  readonly is_completed: boolean
  readonly is_archived: boolean
  readonly created_at: string
  readonly updated_at: string
}

export type TodoListResponse = {
  readonly items: readonly Todo[]
  readonly total: number
  readonly limit: number
  readonly offset: number
}

export type TodoDueSummaryResponse = {
  readonly target_date: string
  readonly today_items: readonly Todo[]
  readonly overdue_items: readonly Todo[]
}

export type TodoDueSummaryState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'ready'; readonly data: TodoDueSummaryResponse }
  | { readonly phase: 'error' }

export type TodoCreateInput = {
  readonly title: string
  readonly description: string
  readonly dueDate: string
  readonly priority: TodoPriority
  readonly category: string
  readonly equipmentId?: string
  readonly isCompleted?: boolean
  readonly isPinned?: boolean
}

export type TodoCompletionInput = {
  readonly isCompleted: boolean
}

export type TodoPinnedInput = {
  readonly isPinned: boolean
}

export type TodoArchivedInput = {
  readonly isArchived: boolean
}

export type TodoBulkCompletionResult = {
  readonly updatedItems: readonly Todo[]
  readonly failedIds: readonly string[]
}

export type TodoBulkPinnedResult = {
  readonly updatedItems: readonly Todo[]
  readonly failedIds: readonly string[]
}

export type TodoBulkPriorityResult = {
  readonly updatedItems: readonly Todo[]
  readonly failedIds: readonly string[]
}

export type TodoBulkCategoryResult = {
  readonly updatedItems: readonly Todo[]
  readonly failedIds: readonly string[]
}

export type TodoBulkDueDateResult = {
  readonly updatedItems: readonly Todo[]
  readonly failedIds: readonly string[]
}

export type TodoBulkDuplicateResult = {
  readonly createdItems: readonly Todo[]
  readonly failedIds: readonly string[]
}

export type TodoBulkDeleteResult = {
  readonly deletedIds: readonly string[]
  readonly failedIds: readonly string[]
}

export type TodoBulkImportResult = {
  readonly createdItems: readonly Todo[]
  readonly failedIndexes: readonly number[]
}

export type TodoEditInput = {
  readonly title: string
  readonly description: string
  readonly dueDate: string
  readonly priority: TodoPriority
  readonly category: string
  readonly equipmentId: string
}

export type TodoCollectionState =
  | { readonly phase: 'loading' }
  | {
      readonly phase: 'ready'
      readonly items: readonly Todo[]
      readonly total: number
    }
  | { readonly phase: 'error' }
