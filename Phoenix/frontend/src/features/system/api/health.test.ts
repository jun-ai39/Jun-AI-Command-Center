import { afterEach, describe, expect, it, vi } from 'vitest'

import { fetchHealth, HealthApiError } from './health'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('fetchHealth', () => {
  it('returns a validated health response', async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValue(
      new Response(
        JSON.stringify({
          status: 'ok',
          service: 'phoenix-api',
          version: '0.1.0',
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const result = await fetchHealth({ baseUrl: 'https://api.example.test/' })

    expect(result).toEqual({
      status: 'ok',
      service: 'phoenix-api',
      version: '0.1.0',
    })
    expect(fetchMock).toHaveBeenCalledOnce()
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.example.test/health',
      expect.objectContaining({
        headers: { Accept: 'application/json' },
      }),
    )
  })

  it('rejects an unsuccessful HTTP response', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(null, { status: 503 })),
    )

    await expect(
      fetchHealth({ baseUrl: 'https://api.example.test' }),
    ).rejects.toThrow(HealthApiError)
  })

  it('rejects a response with an unexpected shape', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn<typeof fetch>().mockResolvedValue(
        new Response(JSON.stringify({ status: 'unknown' }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    )

    await expect(
      fetchHealth({ baseUrl: 'https://api.example.test' }),
    ).rejects.toThrow(HealthApiError)
  })
})
