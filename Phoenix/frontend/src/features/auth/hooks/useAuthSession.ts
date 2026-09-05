import { useCallback, useEffect, useState } from 'react'

import {
  AuthApiError,
  fetchCurrentUser,
  loginUser,
  logoutUser,
} from '../api/auth'
import { subscribeToSessionExpiry } from '../api/sessionExpiry'
import type { AuthSessionState, LoginCredentials, LoginFailure } from '../types'

type AuthSessionController = {
  readonly state: AuthSessionState
  readonly isLoggingIn: boolean
  readonly loginFailure: LoginFailure | null
  readonly isLoggingOut: boolean
  readonly logoutFailed: boolean
  readonly login: (credentials: LoginCredentials) => Promise<boolean>
  readonly logout: () => Promise<void>
  readonly retrySessionCheck: () => void
}

function wasAborted(error: unknown): boolean {
  return error instanceof DOMException && error.name === 'AbortError'
}

export function requireReauthentication(
  state: AuthSessionState,
): AuthSessionState {
  if (state.phase !== 'signed-in') return state
  return { phase: 'reauth-required', user: state.user }
}

export function useAuthSession(): AuthSessionController {
  const [state, setState] = useState<AuthSessionState>({ phase: 'checking' })
  const [checkRequest, setCheckRequest] = useState(0)
  const [isLoggingIn, setIsLoggingIn] = useState(false)
  const [loginFailure, setLoginFailure] = useState<LoginFailure | null>(null)
  const [isLoggingOut, setIsLoggingOut] = useState(false)
  const [logoutFailed, setLogoutFailed] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    void fetchCurrentUser({ signal: controller.signal })
      .then((user) => {
        if (!controller.signal.aborted) {
          setState({ phase: 'signed-in', user })
        }
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted || wasAborted(error)) return
        if (error instanceof AuthApiError && error.kind === 'unauthorized') {
          setState({ phase: 'signed-out' })
          return
        }
        setState({ phase: 'unavailable' })
      })

    return () => controller.abort()
  }, [checkRequest])

  useEffect(
    () =>
      subscribeToSessionExpiry(() => {
        setState(requireReauthentication)
      }),
    [],
  )

  const retrySessionCheck = useCallback(() => {
    setLoginFailure(null)
    setState({ phase: 'checking' })
    setCheckRequest((current) => current + 1)
  }, [])

  const login = useCallback(async (credentials: LoginCredentials) => {
    setIsLoggingIn(true)
    setLoginFailure(null)
    try {
      const user = await loginUser(credentials)
      setState({ phase: 'signed-in', user })
      return true
    } catch (error) {
      setLoginFailure(
        error instanceof AuthApiError && error.kind === 'unauthorized'
          ? 'credentials'
          : 'unavailable',
      )
      return false
    } finally {
      setIsLoggingIn(false)
    }
  }, [])

  const logout = useCallback(async () => {
    setIsLoggingOut(true)
    setLogoutFailed(false)
    try {
      await logoutUser()
      setState({ phase: 'signed-out' })
    } catch {
      setLogoutFailed(true)
    } finally {
      setIsLoggingOut(false)
    }
  }, [])

  return {
    state,
    isLoggingIn,
    loginFailure,
    isLoggingOut,
    logoutFailed,
    login,
    logout,
    retrySessionCheck,
  }
}
