import type { AuthenticatedUser, LoginCredentials } from '../types'

const DEFAULT_API_BASE_URL = 'http://127.0.0.1:8000'

type AuthRequestOptions = {
  readonly baseUrl?: string
  readonly signal?: AbortSignal
}

export type AuthApiErrorKind =
  'unauthorized' | 'unavailable' | 'invalid-response'

export class AuthApiError extends Error {
  readonly kind: AuthApiErrorKind
  readonly status?: number

  constructor(kind: AuthApiErrorKind, message: string, status?: number) {
    super(message)
    this.name = 'AuthApiError'
    this.kind = kind
    this.status = status
  }
}

function getApiBaseUrl(): string {
  const configuredUrl = import.meta.env.VITE_API_BASE_URL?.trim()
  return configuredUrl || DEFAULT_API_BASE_URL
}

function removeTrailingSlash(url: string): string {
  return url.replace(/\/$/, '')
}

function getBaseUrl(configuredUrl?: string): string {
  return removeTrailingSlash(configuredUrl ?? getApiBaseUrl())
}

function isAbortError(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

async function request(url: string, init: RequestInit): Promise<Response> {
  try {
    return await fetch(url, init)
  } catch (error) {
    if (isAbortError(error)) throw error
    throw new AuthApiError('unavailable', 'Phoenix APIへ接続できませんでした。')
  }
}

function isAuthenticatedUser(value: unknown): value is AuthenticatedUser {
  if (typeof value !== 'object' || value === null) return false
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.username === 'string' &&
    record.username.trim().length > 0 &&
    (record.role === 'admin' || record.role === 'user') &&
    record.is_active === true &&
    typeof record.created_at === 'string' &&
    !Number.isNaN(Date.parse(record.created_at))
  )
}

async function readUserResponse(
  response: Response,
): Promise<AuthenticatedUser> {
  if (response.status === 401) {
    throw new AuthApiError(
      'unauthorized',
      'ユーザー名またはパスワードを確認してください。',
      401,
    )
  }
  if (!response.ok) {
    throw new AuthApiError(
      'unavailable',
      `Authentication API returned HTTP ${response.status}`,
      response.status,
    )
  }

  let payload: unknown
  try {
    payload = await response.json()
  } catch {
    throw new AuthApiError(
      'invalid-response',
      'Authentication API returned invalid JSON.',
    )
  }
  if (!isAuthenticatedUser(payload)) {
    throw new AuthApiError(
      'invalid-response',
      'Authentication API returned an invalid user.',
    )
  }
  return payload
}

export async function fetchCurrentUser(
  options: AuthRequestOptions = {},
): Promise<AuthenticatedUser> {
  const response = await request(`${getBaseUrl(options.baseUrl)}/auth/me`, {
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal: options.signal,
  })
  return readUserResponse(response)
}

export async function loginUser(
  credentials: LoginCredentials,
  options: AuthRequestOptions = {},
): Promise<AuthenticatedUser> {
  const response = await request(`${getBaseUrl(options.baseUrl)}/auth/login`, {
    method: 'POST',
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(credentials),
    signal: options.signal,
  })
  return readUserResponse(response)
}

export async function logoutUser(
  options: AuthRequestOptions = {},
): Promise<void> {
  const response = await request(`${getBaseUrl(options.baseUrl)}/auth/logout`, {
    method: 'POST',
    credentials: 'include',
    headers: { Accept: 'application/json' },
    signal: options.signal,
  })
  if (response.status !== 204) {
    throw new AuthApiError(
      'unavailable',
      `Authentication API returned HTTP ${response.status}`,
      response.status,
    )
  }
}
