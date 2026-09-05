import { afterEach, describe, expect, it, vi } from 'vitest'

import { authenticatedFetch } from './authenticatedFetch'
import { subscribeToSessionExpiry } from './sessionExpiry'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('authenticatedFetch', () => {
  it('always sends the Phoenix session cookie with a business request', async () => {
    const response = new Response(null, { status: 204 })
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(response)
    vi.stubGlobal('fetch', fetchMock)

    await expect(
      authenticatedFetch('https://api.example.test/todos', {
        method: 'POST',
        credentials: 'omit',
      }),
    ).resolves.toBe(response)

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/todos',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    )
  })

  it('notifies once and never retries when a business request returns 401', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 401 }))
    const onExpired = vi.fn()
    const unsubscribe = subscribeToSessionExpiry(onExpired)
    vi.stubGlobal('fetch', fetchMock)

    try {
      const response = await authenticatedFetch(
        'https://api.example.test/work-reports',
        { method: 'POST' },
      )

      expect(response.status).toBe(401)
      expect(onExpired).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledTimes(1)
    } finally {
      unsubscribe()
    }
  })

  it('does not request reauthentication for a non-401 failure', async () => {
    const onExpired = vi.fn()
    const unsubscribe = subscribeToSessionExpiry(onExpired)
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 503 })),
    )

    try {
      const response = await authenticatedFetch(
        'https://api.example.test/equipment',
      )

      expect(response.status).toBe(503)
      expect(onExpired).not.toHaveBeenCalled()
    } finally {
      unsubscribe()
    }
  })
})
