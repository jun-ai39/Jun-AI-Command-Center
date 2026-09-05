import { addDaysToLocalDateString } from './todoDueDate'
import type { Todo, TodoCreateInput } from './types'

export type TodoRepeatOption = {
  readonly label: '1週間後' | '1か月後'
  readonly dueDate: string
}

export function addMonthsToLocalDateString(
  localDateString: string,
  months: number,
): string {
  const [year, month, day] = localDateString.split('-').map(Number)
  const targetMonthStart = new Date(year, month - 1 + months, 1)
  const targetYear = targetMonthStart.getFullYear()
  const targetMonth = targetMonthStart.getMonth()
  const lastDay = new Date(targetYear, targetMonth + 1, 0).getDate()
  const targetDay = Math.min(day, lastDay)

  return `${targetYear}-${String(targetMonth + 1).padStart(2, '0')}-${String(targetDay).padStart(2, '0')}`
}

export function getTodoRepeatOptions(
  todo: Todo,
  today: string,
): readonly TodoRepeatOption[] {
  const baseDate =
    todo.due_date && todo.due_date >= today ? todo.due_date : today

  return [
    { label: '1週間後', dueDate: addDaysToLocalDateString(baseDate, 7) },
    { label: '1か月後', dueDate: addMonthsToLocalDateString(baseDate, 1) },
  ]
}

export function makeTodoRepeatInput(
  todo: Todo,
  dueDate: string,
): TodoCreateInput {
  return {
    title: todo.title,
    description: todo.description ?? '',
    dueDate,
    priority: todo.priority,
    category: todo.category ?? '',
    equipmentId: todo.equipment_id ?? '',
  }
}
