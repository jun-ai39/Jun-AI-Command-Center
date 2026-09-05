import type { Todo, TodoPriority } from './types'

type ClipboardWriter = {
  readonly writeText: (text: string) => Promise<void>
}
type ClipboardFallback = (text: string) => boolean

const TODO_PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

function getBrowserClipboard(): ClipboardWriter | null {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return null
  }
  return navigator.clipboard
}

function copyTextWithSelection(text: string): boolean {
  if (typeof document === 'undefined' || !document.body) {
    return false
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.readOnly = true
  textarea.style.position = 'fixed'
  textarea.style.opacity = '0'
  document.body.append(textarea)
  textarea.select()

  try {
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    textarea.remove()
  }
}

export function buildTodoClipboardText(todo: Todo): string {
  return [
    `ToDo: ${todo.title}`,
    `状態: ${todo.is_completed ? '完了' : '未完了'}`,
    `期限: ${todo.due_date ?? 'なし'}`,
    `優先度: ${TODO_PRIORITY_LABELS[todo.priority]}`,
    `カテゴリ: ${todo.category ?? 'なし'}`,
    `説明: ${todo.description ?? 'なし'}`,
  ].join('\n')
}

export async function copyTodoToClipboard(
  todo: Todo,
  clipboard: ClipboardWriter | null = getBrowserClipboard(),
  fallback: ClipboardFallback = copyTextWithSelection,
): Promise<boolean> {
  const text = buildTodoClipboardText(todo)

  if (clipboard) {
    try {
      await clipboard.writeText(text)
      return true
    } catch {
      // 権限で拒否された場合は、選択範囲を使う方式へ切り替えます。
    }
  }

  try {
    return fallback(text)
  } catch {
    return false
  }
}
