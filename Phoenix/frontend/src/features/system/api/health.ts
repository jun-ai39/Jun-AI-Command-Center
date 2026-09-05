import type { HealthResponse } from '../types'

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'

type FetchHealthOptions = {
  readonly baseUrl?: string
  readonly signal?: AbortSignal
}

export class HealthApiError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HealthApiError'
  }
}

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  return configuredUrl || DEFAULT_API_BASE_URL
}

function removeTrailingSlash(url: string): string {
  return url.replace(/\/$/, '')
}

function isHealthResponse(value: unknown): value is HealthResponse {
  if (typeof value !== 'object' || value === null) {
    return false
  }

  const record = value as Record<string, unknown>
  return (
    record.status === 'ok' &&
    record.service === 'phoenix-api' &&
    typeof record.version === 'string'
  )
}

export async function fetchHealth(
  options: FetchHealthOptions = {},
): Promise<HealthResponse> {
  const baseUrl = removeTrailingSlash(options.baseUrl ?? getApiBaseUrl())
  const response = await fetch(`${baseUrl}/health`, {
    headers: { Accept: 'application/json' },
    signal: options.signal,
  })

  if (!response.ok) {
    throw new HealthApiError(`Health API returned HTTP ${response.status}`)
  }

  const payload: unknown = await response.json()
  if (!isHealthResponse(payload)) {
    throw new HealthApiError('Health API returned an invalid response')
  }

  return payload
}
