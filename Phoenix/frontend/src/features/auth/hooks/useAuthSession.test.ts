import { describe, expect, it } from 'vitest'

import type { AuthenticatedUser, AuthSessionState } from '../types'
import { requireReauthentication } from './useAuthSession'

const USER: AuthenticatedUser = {
  id: 'a1000000-0000-4000-8000-000000000001',
  username: 'jun.admin',
  role: 'admin',
  is_active: true,
  created_at: '2026-08-28T00:00:00+00:00',
}

describe('requireReauthentication', () => {
  it('locks only a currently signed-in session and keeps its user', () => {
    expect(requireReauthentication({ phase: 'signed-in', user: USER })).toEqual(
      { phase: 'reauth-required', user: USER },
    )
  })

  it('does not create duplicate locks or change another auth phase', () => {
    const alreadyLocked: AuthSessionState = {
      phase: 'reauth-required',
      user: USER,
    }
    const signedOut: AuthSessionState = { phase: 'signed-out' }

    expect(requireReauthentication(alreadyLocked)).toBe(alreadyLocked)
    expect(requireReauthentication(signedOut)).toBe(signedOut)
  })
})
