import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchCurrentUser, loginUser, logoutUser } from './auth'

const USER_RESPONSE = {
  id: 'a1000000-0000-4000-8000-000000000001',
  username: 'jun.admin',
  role: 'admin',
  is_active: true,
  created_at: '2026-08-28T00:00:00+00:00',
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('authentication API', () => {
  it('restores the current user with the HttpOnly cookie', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(USER_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const user = await fetchCurrentUser({
      baseUrl: 'https://api.example.test/',
    })

    expect(user).toEqual(USER_RESPONSE)
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/auth/me',
      expect.objectContaining({
        credentials: 'include',
        headers: { Accept: 'application/json' },
      }),
    )
  })

  it('distinguishes an expired session from an unavailable API', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 401 })),
    )

    await expect(
      fetchCurrentUser({ baseUrl: 'https://api.example.test' }),
    ).rejects.toMatchObject({
      kind: 'unauthorized',
      status: 401,
    })
  })

  it('sends login credentials only in the request body', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(JSON.stringify(USER_RESPONSE), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const user = await loginUser(
      { username: 'jun.admin', password: 'fictional-password-2026' },
      { baseUrl: 'https://api.example.test' },
    )

    expect(user.username).toBe('jun.admin')
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/auth/login',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
        body: JSON.stringify({
          username: 'jun.admin',
          password: 'fictional-password-2026',
        }),
      }),
    )
  })

  it('rejects an unexpected user role', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ ...USER_RESPONSE, role: 'owner' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(
      fetchCurrentUser({ baseUrl: 'https://api.example.test' }),
    ).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('rejects an inactive user response', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ ...USER_RESPONSE, is_active: false }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(
      fetchCurrentUser({ baseUrl: 'https://api.example.test' }),
    ).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it('reports network failures as unavailable', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockRejectedValue(new TypeError('network failed')),
    )

    await expect(
      fetchCurrentUser({ baseUrl: 'https://api.example.test' }),
    ).rejects.toMatchObject({ kind: 'unavailable' })
  })

  it('ends the server session without expecting response content', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValue(new Response(null, { status: 204 }))
    vi.stubGlobal('fetch', fetchMock)

    await logoutUser({ baseUrl: 'https://api.example.test/' })

    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/auth/logout',
      expect.objectContaining({
        method: 'POST',
        credentials: 'include',
      }),
    )
  })
})
