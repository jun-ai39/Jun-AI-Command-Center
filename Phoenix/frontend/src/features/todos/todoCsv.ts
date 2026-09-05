import type { Todo, TodoCreateInput, TodoPriority } from './types'

const TODO_PRIORITY_LABELS: Record<TodoPriority, string> = {
  high: '高',
  medium: '中',
  low: '低',
}

const TODO_PRIORITIES_BY_LABEL: Record<string, TodoPriority> = {
  高: 'high',
  中: 'medium',
  低: 'low',
}

const CSV_HEADERS = [
  'タイトル',
  '説明',
  '期限',
  '優先度',
  'カテゴリ',
  '状態',
  '固定',
  '作成日時',
  '更新日時',
] as const

const LEGACY_CSV_HEADERS = [
  'タイトル',
  '説明',
  '期限',
  '優先度',
  'カテゴリ',
  '状態',
  '作成日時',
  '更新日時',
] as const

const MAX_CSV_IMPORT_ITEMS = 50
const MAX_CSV_CHARACTERS = 1_000_000

export class TodoCsvError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'TodoCsvError'
  }
}

function protectSpreadsheetFormula(value: string): string {
  return /^[\t\r\n ]*[=+\-@]/.test(value) ? `'${value}` : value
}

function escapeCsvCell(value: string): string {
  return `"${protectSpreadsheetFormula(value).replaceAll('"', '""')}"`
}

function restoreSpreadsheetFormula(value: string): string {
  return /^'[=+\-@]/.test(value) ? value.slice(1) : value
}

function parseCsvRows(csv: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let isQuoted = false
  let didCloseQuote = false

  function finishCell() {
    row.push(cell)
    cell = ''
    didCloseQuote = false
  }

  function finishRow() {
    finishCell()
    rows.push(row)
    row = []
  }

  for (let index = 0; index < csv.length; index += 1) {
    const character = csv[index]

    if (isQuoted) {
      if (character !== '"') {
        cell += character
        continue
      }
      if (csv[index + 1] === '"') {
        cell += '"'
        index += 1
        continue
      }

      isQuoted = false
      didCloseQuote = true
      continue
    }

    if (
      didCloseQuote &&
      character !== ',' &&
      character !== '\r' &&
      character !== '\n'
    ) {
      throw new TodoCsvError('引用符の後に不要な文字があります。')
    }
    if (character === '"') {
      if (cell.length > 0) {
        throw new TodoCsvError('引用符の位置が正しくありません。')
      }
      isQuoted = true
    } else if (character === ',') {
      finishCell()
    } else if (character === '\n') {
      finishRow()
    } else if (character === '\r') {
      if (csv[index + 1] === '\n') {
        index += 1
      }
      finishRow()
    } else {
      cell += character
    }
  }

  if (isQuoted) {
    throw new TodoCsvError('閉じられていない引用符があります。')
  }
  if (row.length > 0 || cell.length > 0 || didCloseQuote) {
    finishRow()
  }

  return rows.filter((fields) => fields.some((value) => value.trim()))
}

function isValidDateString(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false
  }

  const [year, month, day] = value.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  )
}

function matchesHeaders(
  header: readonly string[],
  expectedHeaders: readonly string[],
): boolean {
  return (
    header.length === expectedHeaders.length &&
    header.every((value, index) => value === expectedHeaders[index])
  )
}

export function parseTodosCsv(csv: string): TodoCreateInput[] {
  if (csv.length > MAX_CSV_CHARACTERS) {
    throw new TodoCsvError('CSVファイルが大きすぎます。')
  }

  const rows = parseCsvRows(csv.replace(/^\uFEFF/, ''))
  const header = rows[0]
  const hasPinnedColumn = Boolean(header && matchesHeaders(header, CSV_HEADERS))
  const isLegacyFormat = Boolean(
    header && matchesHeaders(header, LEGACY_CSV_HEADERS),
  )
  if (!hasPinnedColumn && !isLegacyFormat) {
    throw new TodoCsvError('Phoenixで書き出したCSVの列名と一致しません。')
  }
  const expectedColumnCount = hasPinnedColumn
    ? CSV_HEADERS.length
    : LEGACY_CSV_HEADERS.length

  const dataRows = rows.slice(1)
  if (dataRows.length === 0) {
    throw new TodoCsvError('登録できるToDoがありません。')
  }
  if (dataRows.length > MAX_CSV_IMPORT_ITEMS) {
    throw new TodoCsvError('一度に登録できるToDoは50件までです。')
  }

  return dataRows.map((fields, index) => {
    const rowNumber = index + 2
    if (fields.length !== expectedColumnCount) {
      throw new TodoCsvError(`${rowNumber}行目の列数が正しくありません。`)
    }

    const title = restoreSpreadsheetFormula(fields[0].trim())
    const description = restoreSpreadsheetFormula(fields[1].trim())
    const dueDate = fields[2].trim()
    const priority = TODO_PRIORITIES_BY_LABEL[fields[3].trim()]
    const category = restoreSpreadsheetFormula(fields[4].trim())
    const status = fields[5].trim()
    const pinnedStatus = hasPinnedColumn ? fields[6].trim() : '通常'

    if (!title || title.length > 200) {
      throw new TodoCsvError(
        `${rowNumber}行目のタイトルは1～200文字で入力してください。`,
      )
    }
    if (description.length > 5000) {
      throw new TodoCsvError(
        `${rowNumber}行目の説明は5000文字以内で入力してください。`,
      )
    }
    if (dueDate && !isValidDateString(dueDate)) {
      throw new TodoCsvError(`${rowNumber}行目の期限が正しくありません。`)
    }
    if (!priority) {
      throw new TodoCsvError(
        `${rowNumber}行目の優先度は「高」「中」「低」から選んでください。`,
      )
    }
    if (category.length > 30) {
      throw new TodoCsvError(
        `${rowNumber}行目のカテゴリは30文字以内で入力してください。`,
      )
    }
    if (status !== '完了' && status !== '未完了') {
      throw new TodoCsvError(
        `${rowNumber}行目の状態は「完了」または「未完了」にしてください。`,
      )
    }
    if (pinnedStatus !== '固定' && pinnedStatus !== '通常') {
      throw new TodoCsvError(
        `${rowNumber}行目の固定欄は「固定」または「通常」にしてください。`,
      )
    }

    return {
      title,
      description,
      dueDate,
      priority,
      category,
      isCompleted: status === '完了',
      isPinned: pinnedStatus === '固定',
    }
  })
}

export function buildTodosCsv(todos: readonly Todo[]): string {
  const rows = todos.map((todo) => [
    todo.title,
    todo.description ?? '',
    todo.due_date ?? '',
    TODO_PRIORITY_LABELS[todo.priority],
    todo.category ?? '',
    todo.is_completed ? '完了' : '未完了',
    todo.is_pinned ? '固定' : '通常',
    todo.created_at,
    todo.updated_at,
  ])

  const csv = [CSV_HEADERS, ...rows]
    .map((row) => row.map(escapeCsvCell).join(','))
    .join('\r\n')

  return `\uFEFF${csv}`
}

export function downloadTodosCsv(
  todos: readonly Todo[],
  localDate: string,
): void {
  const blob = new Blob([buildTodosCsv(todos)], {
    type: 'text/csv;charset=utf-8',
  })
  const objectUrl = URL.createObjectURL(blob)
  const downloadLink = document.createElement('a')

  downloadLink.href = objectUrl
  downloadLink.download = `phoenix-todos-${localDate}.csv`
  downloadLink.hidden = true
  document.body.append(downloadLink)
  downloadLink.click()
  downloadLink.remove()
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 0)
}
