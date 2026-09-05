import { afterEach, describe, expect, it, vi } from 'vitest'

import {
  createTodo,
  createTodoDuplicates,
  createTodos,
  deleteTodo,
  deleteTodos,
  fetchRemainingTodos,
  fetchTodoDueSummary,
  fetchTodos,
  TodoApiError,
  updateTodoArchived,
  updateTodoCompletion,
  updateTodoDetails,
  updateTodoPinned,
  updateTodosCategory,
  updateTodosCompletion,
  updateTodosDueDate,
  updateTodosPinned,
  updateTodosPriority,
} from './todos'

const EQUIPMENT_ID = '30000000-0000-4000-8000-000000000001'

const todo = {
  id: 'a48af9d2-e26c-469f-bbeb-2d99ffbd15c2',
  title: 'Phoenix UIを確認する',
  description: null,
  due_date: '2026-07-23',
  priority: 'medium' as const,
  category: '学習',
  equipment_id: null,
  is_pinned: false,
  is_completed: false,
  is_archived: false,
  created_at: '2026-07-22T15:00:00Z',
  updated_at: '2026-07-22T15:00:00Z',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchTodos', () => {
  it('returns a validated collection', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ items: [todo], total: 1, limit: 50, offset: 0 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchTodos({ baseUrl: 'https://api.example.test/' })

    expect(result.items).toEqual([todo])
    expect(result.total).toBe(1)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/todos',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('requests an explicit page for additional loading', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(
          JSON.stringify({ items: [todo], total: 75, limit: 50, offset: 50 }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    await fetchTodos({
      baseUrl: 'https://api.example.test/',
      limit: 50,
      offset: 50,
    })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/todos?limit=50&offset=50',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('rejects an unsuccessful response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 503 })),
    )

    await expect(
      fetchTodos({ baseUrl: 'https://api.example.test' }),
    ).rejects.toThrow(TodoApiError)
  })

  it('rejects an unexpected collection shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ items: 'invalid' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(
      fetchTodos({ baseUrl: 'https://api.example.test' }),
    ).rejects.toThrow(TodoApiError)
  })

  it('rejects an item with an unsupported priority', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            items: [{ ...todo, priority: 'urgent' }],
            total: 1,
            limit: 50,
            offset: 0,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    await expect(
      fetchTodos({ baseUrl: 'https://api.example.test' }),
    ).rejects.toThrow(TodoApiError)
  })
})

describe('fetchTodoDueSummary', () => {
  it('validates the local date and grouped maintenance schedules', async () => {
    const todayTodo = { ...todo, due_date: '2026-08-22' }
    const overdueTodo = {
      ...todo,
      id: '7aa91dc1-a532-4e65-9953-19943c31e1d8',
      due_date: '2026-08-21',
    }
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          target_date: '2026-08-22',
          today_items: [todayTodo],
          overdue_items: [overdueTodo],
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchTodoDueSummary('2026-08-22', {
      baseUrl: 'https://api.example.test/',
    })

    expect(result.today_items).toEqual([todayTodo])
    expect(result.overdue_items).toEqual([overdueTodo])
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/todos/due-summary?target_date=2026-08-22',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('rejects completed items in the active due summary', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(
          JSON.stringify({
            target_date: '2026-08-22',
            today_items: [
              { ...todo, due_date: '2026-08-22', is_completed: true },
            ],
            overdue_items: [],
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    )

    await expect(fetchTodoDueSummary('2026-08-22')).rejects.toThrow(
      TodoApiError,
    )
  })
})

describe('fetchRemainingTodos', () => {
  it('continues requesting pages until every remaining item is collected', async () => {
    const secondTodo = { ...todo, id: 'todo-2', title: '2件目' }
    const thirdTodo = { ...todo, id: 'todo-3', title: '3件目' }
    const fourthTodo = { ...todo, id: 'todo-4', title: '4件目' }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [secondTodo, thirdTodo],
            total: 4,
            limit: 2,
            offset: 1,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            items: [fourthTodo],
            total: 4,
            limit: 2,
            offset: 3,
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      )
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchRemainingTodos({
      baseUrl: 'https://api.example.test/',
      limit: 2,
      offset: 1,
    })

    expect(result).toEqual({
      items: [secondTodo, thirdTodo, fourthTodo],
      total: 4,
    })
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://api.example.test/todos?limit=2&offset=1',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://api.example.test/todos?limit=2&offset=3',
      expect.objectContaining({ headers: { Accept: 'application/json' } }),
    )
  })

  it('rejects an empty page before the reported total is reached', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(
          new Response(
            JSON.stringify({ items: [], total: 4, limit: 2, offset: 1 }),
            { status: 200, headers: { 'Content-Type': 'application/json' } },
          ),
        ),
    )

    await expect(
      fetchRemainingTodos({
        baseUrl: 'https://api.example.test/',
        limit: 2,
        offset: 1,
      }),
    ).rejects.toThrow(TodoApiError)
  })
})

describe('createTodo', () => {
  it('normalizes input and returns the created item', async () => {
    const linkedTodo = { ...todo, equipment_id: EQUIPMENT_ID }
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(linkedTodo), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await createTodo(
      {
        title: '  Phoenix UIを確認する  ',
        description: '   ',
        dueDate: '2026-07-23',
        priority: 'high',
        category: '  学習  ',
        equipmentId: `  ${EQUIPMENT_ID}  `,
      },
      { baseUrl: 'https://api.example.test' },
    )

    expect(result).toEqual(linkedTodo)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/todos',
      expect.objectContaining({
        method: 'POST',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: 'Phoenix UIを確認する',
          description: null,
          due_date: '2026-07-23',
          priority: 'high',
          category: '学習',
          equipment_id: EQUIPMENT_ID,
        }),
      }),
    )
  })

  it('rejects an invalid created item', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ id: 'missing-fields' }), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(
      createTodo(
        {
          title: '確認',
          description: '',
          dueDate: '',
          priority: 'medium',
          category: '',
        },
        { baseUrl: 'https://api.example.test' },
      ),
    ).rejects.toThrow(TodoApiError)
  })

  it('sends an explicit completion state for a CSV import', async () => {
    const completedTodo = { ...todo, is_completed: true }
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(completedTodo), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await createTodo(
      {
        title: '完了状態を復元する',
        description: '',
        dueDate: '',
        priority: 'medium',
        category: '',
        isCompleted: true,
      },
      { baseUrl: 'https://api.example.test' },
    )

    const requestBody = fetchMock.mock.calls[0]?.[1]?.body
    expect(typeof requestBody).toBe('string')
    expect(JSON.parse(String(requestBody))).toMatchObject({
      title: '完了状態を復元する',
      is_completed: true,
    })
  })

  it('sends an explicit pinned state for a CSV import', async () => {
    const pinnedTodo = { ...todo, is_pinned: true }
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(pinnedTodo), {
        status: 201,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    await createTodo(
      {
        title: '固定状態を復元する',
        description: '',
        dueDate: '',
        priority: 'high',
        category: '',
        isPinned: true,
      },
      { baseUrl: 'https://api.example.test' },
    )

    const requestBody = fetchMock.mock.calls[0]?.[1]?.body
    expect(typeof requestBody).toBe('string')
    expect(JSON.parse(String(requestBody))).toMatchObject({
      title: '固定状態を復元する',
      is_pinned: true,
    })
  })
})

describe('createTodos', () => {
  it('creates inputs sequentially and reports the indexes that failed', async () => {
    const secondTodo = { ...todo, id: 'todo-2', title: '2件目' }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(todo), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 422 }))
      .mockResolvedValueOnce(
        new Response(JSON.stringify(secondTodo), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
    vi.stubGlobal('fetch', fetchMock)

    const result = await createTodos(
      [
        {
          title: '1件目',
          description: '',
          dueDate: '',
          priority: 'medium',
          category: '',
        },
        {
          title: '失敗する行',
          description: '',
          dueDate: '',
          priority: 'high',
          category: '',
        },
        {
          title: '2件目',
          description: '',
          dueDate: '',
          priority: 'low',
          category: '',
        },
      ],
      { baseUrl: 'https://api.example.test/' },
    )

    expect(result).toEqual({
      createdItems: [todo, secondTodo],
      failedIndexes: [1],
    })
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })
})

describe('createTodoDuplicates', () => {
  it('duplicates unique todos and reports the source ids that failed', async () => {
    const firstTodo = { ...todo, id: 'todo-one', title: '学習を進める' }
    const secondTodo = {
      ...todo,
      id: 'todo-two',
      title: '設備を点検する',
      is_completed: true,
    }
    const createdFirstTodo = {
      ...firstTodo,
      id: 'copy-one',
      title: '学習を進める（コピー）',
    }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(createdFirstTodo), {
          status: 201,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      createTodoDuplicates([firstTodo, firstTodo, secondTodo], {
        baseUrl: 'https://example.test/api',
      }),
    ).resolves.toEqual({
      createdItems: [createdFirstTodo],
      failedIds: ['todo-two'],
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    const firstRequestBody = JSON.parse(
      fetchMock.mock.calls[0][1].body as string,
    )
    expect(firstRequestBody).toMatchObject({
      title: '学習を進める（コピー）',
    })
    expect(firstRequestBody).not.toHaveProperty('is_completed')
    expect(JSON.parse(fetchMock.mock.calls[1][1].body as string)).toMatchObject(
      {
        title: '設備を点検する（コピー）',
      },
    )
  })
})

describe('deleteTodos', () => {
  it('deletes unique ids and reports the ids that failed', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(new Response(null, { status: 204 }))
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      deleteTodos(['todo-one', 'todo-one', 'todo-two'], {
        baseUrl: 'https://example.test/api',
      }),
    ).resolves.toEqual({
      deletedIds: ['todo-one'],
      failedIds: ['todo-two'],
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://example.test/api/todos/todo-one',
      expect.objectContaining({ method: 'DELETE' }),
    )
  })
})

describe('updateTodoCompletion', () => {
  it('sends the next completion state and validates the updated item', async () => {
    const completedTodo = { ...todo, is_completed: true }
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(completedTodo), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await updateTodoCompletion(
      todo.id,
      { isCompleted: true },
      { baseUrl: 'https://api.example.test/' },
    )

    expect(result).toEqual(completedTodo)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/todos/${todo.id}`,
      expect.objectContaining({
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ is_completed: true }),
      }),
    )
  })

  it('rejects an invalid updated item', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ ...todo, is_completed: 'yes' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(
      updateTodoCompletion(
        todo.id,
        { isCompleted: true },
        { baseUrl: 'https://api.example.test' },
      ),
    ).rejects.toThrow(TodoApiError)
  })
})

describe('updateTodoArchived', () => {
  it('sends the next archive state and validates the updated item', async () => {
    const archivedTodo = {
      ...todo,
      is_completed: true,
      is_archived: true,
    }
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(archivedTodo), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await updateTodoArchived(
      todo.id,
      { isArchived: true },
      { baseUrl: 'https://api.example.test/' },
    )

    expect(result).toEqual(archivedTodo)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/todos/${todo.id}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ is_archived: true }),
      }),
    )
  })

  it('rejects an invalid archive state in the response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ ...todo, is_archived: 'yes' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(
      updateTodoArchived(
        todo.id,
        { isArchived: true },
        { baseUrl: 'https://api.example.test' },
      ),
    ).rejects.toThrow(TodoApiError)
  })
})

describe('updateTodoPinned', () => {
  it('sends the next pinned state and validates the updated item', async () => {
    const pinnedTodo = { ...todo, is_pinned: true }
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(pinnedTodo), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await updateTodoPinned(
      todo.id,
      { isPinned: true },
      { baseUrl: 'https://api.example.test/' },
    )

    expect(result).toEqual(pinnedTodo)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/todos/${todo.id}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ is_pinned: true }),
      }),
    )
  })

  it('rejects an invalid pinned state in the response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ ...todo, is_pinned: 'yes' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(
      updateTodoPinned(
        todo.id,
        { isPinned: true },
        { baseUrl: 'https://api.example.test' },
      ),
    ).rejects.toThrow(TodoApiError)
  })
})

describe('updateTodosPinned', () => {
  it('updates unique ids and reports the ids that failed', async () => {
    const secondTodoId = '45e36285-21b9-4bc0-adb9-e5ae61d12a14'
    const pinnedTodo = { ...todo, is_pinned: true }
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(pinnedTodo), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await updateTodosPinned(
      [todo.id, todo.id, secondTodoId],
      { isPinned: true },
      { baseUrl: 'https://api.example.test' },
    )

    expect(result.updatedItems).toEqual([pinnedTodo])
    expect(result.failedIds).toEqual([secondTodoId])
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      `https://api.example.test/todos/${todo.id}`,
      expect.objectContaining({
        method: 'PATCH',
        body: JSON.stringify({ is_pinned: true }),
      }),
    )
  })
})

describe('updateTodosCompletion', () => {
  it('returns successful items and the ids that failed', async () => {
    const secondTodoId = '45e36285-21b9-4bc0-adb9-e5ae61d12a14'
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...todo, is_completed: true }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 503 }))
    vi.stubGlobal('fetch', fetchMock)

    const result = await updateTodosCompletion(
      [todo.id, secondTodoId, todo.id],
      { isCompleted: true },
      { baseUrl: 'https://api.example.test' },
    )

    expect(result.updatedItems).toEqual([{ ...todo, is_completed: true }])
    expect(result.failedIds).toEqual([secondTodoId])
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('updateTodosPriority', () => {
  it('updates unique todos and reports the ids that failed', async () => {
    const firstTodo = { ...todo, id: 'todo-one', priority: 'medium' as const }
    const secondTodo = { ...todo, id: 'todo-two', priority: 'low' as const }
    const updatedFirstTodo = { ...firstTodo, priority: 'high' as const }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(updatedFirstTodo), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      updateTodosPriority([firstTodo, firstTodo, secondTodo], 'high', {
        baseUrl: 'https://example.test/api',
      }),
    ).resolves.toEqual({
      updatedItems: [updatedFirstTodo],
      failedIds: ['todo-two'],
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://example.test/api/todos/todo-one',
    )
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject(
      {
        priority: 'high',
      },
    )
  })
})

describe('updateTodosCategory', () => {
  it('updates unique todos and reports the ids that failed', async () => {
    const firstTodo = { ...todo, id: 'todo-one', category: '学習' }
    const secondTodo = { ...todo, id: 'todo-two', category: null }
    const updatedFirstTodo = { ...firstTodo, category: '設備保全' }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(updatedFirstTodo), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      updateTodosCategory([firstTodo, firstTodo, secondTodo], '設備保全', {
        baseUrl: 'https://example.test/api',
      }),
    ).resolves.toEqual({
      updatedItems: [updatedFirstTodo],
      failedIds: ['todo-two'],
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://example.test/api/todos/todo-one',
    )
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject(
      {
        category: '設備保全',
      },
    )
  })
})

describe('updateTodosDueDate', () => {
  it('updates unique todos and reports the ids that failed', async () => {
    const firstTodo = { ...todo, id: 'todo-one', due_date: '2026-07-22' }
    const secondTodo = { ...todo, id: 'todo-two', due_date: null }
    const updatedFirstTodo = { ...firstTodo, due_date: '2026-07-24' }
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify(updatedFirstTodo), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      )
      .mockResolvedValueOnce(new Response(null, { status: 500 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      updateTodosDueDate([firstTodo, firstTodo, secondTodo], '2026-07-24', {
        baseUrl: 'https://example.test/api',
      }),
    ).resolves.toEqual({
      updatedItems: [updatedFirstTodo],
      failedIds: ['todo-two'],
    })

    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://example.test/api/todos/todo-one',
    )
    expect(JSON.parse(fetchMock.mock.calls[0][1].body as string)).toMatchObject(
      {
        due_date: '2026-07-24',
      },
    )
  })
})

describe('updateTodoDetails', () => {
  it('normalizes editable fields and validates the updated item', async () => {
    const editedTodo = {
      ...todo,
      title: '編集後のToDo',
      description: null,
      due_date: null,
      priority: 'low' as const,
      category: null,
    }
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(editedTodo), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await updateTodoDetails(
      todo.id,
      {
        title: '  編集後のToDo  ',
        description: '   ',
        dueDate: '',
        priority: 'low',
        category: '   ',
        equipmentId: '',
      },
      { baseUrl: 'https://api.example.test/' },
    )

    expect(result).toEqual(editedTodo)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/todos/${todo.id}`,
      expect.objectContaining({
        method: 'PATCH',
        headers: {
          Accept: 'application/json',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: '編集後のToDo',
          description: null,
          due_date: null,
          priority: 'low',
          category: null,
          equipment_id: null,
        }),
      }),
    )
  })

  it('rejects an unsuccessful edit response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 422 })),
    )

    await expect(
      updateTodoDetails(
        todo.id,
        {
          title: ' ',
          description: '',
          dueDate: '',
          priority: 'medium',
          category: '',
          equipmentId: '',
        },
        { baseUrl: 'https://api.example.test' },
      ),
    ).rejects.toThrow(TodoApiError)
  })
})

describe('deleteTodo', () => {
  it('deletes the selected item and accepts an empty 204 response', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      deleteTodo(todo.id, { baseUrl: 'https://api.example.test' }),
    ).resolves.toBeUndefined()
    expect(fetchMock).toHaveBeenCalledWith(
      `https://api.example.test/todos/${todo.id}`,
      expect.objectContaining({
        method: 'DELETE',
        headers: { Accept: 'application/json' },
      }),
    )
  })

  it('rejects an unsuccessful delete response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 404 })),
    )

    await expect(
      deleteTodo(todo.id, { baseUrl: 'https://api.example.test' }),
    ).rejects.toThrow(TodoApiError)
  })
})
