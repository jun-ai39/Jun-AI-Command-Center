import type { Todo, TodoCreateInput } from './types'

const TODO_TITLE_MAX_LENGTH = 200
const TODO_COPY_SUFFIX = '（コピー）'

function normalizeTodoTitle(title: string): string {
  return title.normalize('NFKC').trim().toLocaleLowerCase('ja-JP')
}

export function countTodosWithMatchingTitle(
  todos: readonly Todo[],
  title: string,
): number {
  const normalizedTitle = normalizeTodoTitle(title)
  if (!normalizedTitle) {
    return 0
  }

  return todos.filter(
    (todo) => normalizeTodoTitle(todo.title) === normalizedTitle,
  ).length
}

export function getTodoInputIndexesMatchingExistingTitles(
  todos: readonly Todo[],
  inputs: readonly Pick<TodoCreateInput, 'title'>[],
): readonly number[] {
  const existingTitles = new Set(
    todos.map((todo) => normalizeTodoTitle(todo.title)),
  )

  return inputs.flatMap((input, index) => {
    const normalizedTitle = normalizeTodoTitle(input.title)
    return normalizedTitle !== '' && existingTitles.has(normalizedTitle)
      ? [index]
      : []
  })
}

export function countTodoInputsMatchingExistingTitles(
  todos: readonly Todo[],
  inputs: readonly Pick<TodoCreateInput, 'title'>[],
): number {
  return getTodoInputIndexesMatchingExistingTitles(todos, inputs).length
}

export function getTodoInputIndexesWithRepeatedTitles(
  inputs: readonly Pick<TodoCreateInput, 'title'>[],
): readonly number[] {
  const seenTitles = new Set<string>()

  return inputs.flatMap((input, index) => {
    const normalizedTitle = normalizeTodoTitle(input.title)
    if (!normalizedTitle) {
      return []
    }
    if (seenTitles.has(normalizedTitle)) {
      return [index]
    }

    seenTitles.add(normalizedTitle)
    return []
  })
}

export function getTodoInputsExcludingIndexes(
  inputs: readonly TodoCreateInput[],
  excludedIndexes: ReadonlySet<number>,
): readonly TodoCreateInput[] {
  return inputs.filter((_, index) => !excludedIndexes.has(index))
}

export function getTodoInputExcludedIndexes(
  inputCount: number,
  individuallyExcludedIndexes: ReadonlySet<number>,
  duplicateTitleIndexes: ReadonlySet<number>,
  excludeDuplicateTitles: boolean,
): ReadonlySet<number> {
  const excludedIndexes = new Set<number>()
  const addValidIndexes = (indexes: ReadonlySet<number>) => {
    indexes.forEach((index) => {
      if (Number.isInteger(index) && index >= 0 && index < inputCount) {
        excludedIndexes.add(index)
      }
    })
  }

  addValidIndexes(individuallyExcludedIndexes)
  if (excludeDuplicateTitles) {
    addValidIndexes(duplicateTitleIndexes)
  }

  return excludedIndexes
}

export function makeTodoDuplicateInput(todo: Todo): TodoCreateInput {
  const titleBase = todo.title
    .slice(0, TODO_TITLE_MAX_LENGTH - TODO_COPY_SUFFIX.length)
    .trimEnd()

  return {
    title: `${titleBase}${TODO_COPY_SUFFIX}`,
    description: todo.description ?? '',
    dueDate: todo.due_date ?? '',
    priority: todo.priority,
    category: todo.category ?? '',
    equipmentId: todo.equipment_id ?? '',
  }
}
