export type UserRole = 'admin' | 'user'

export type AuthenticatedUser = {
  readonly id: string
  readonly username: string
  readonly role: UserRole
  readonly is_active: boolean
  readonly created_at: string
}

export type LoginCredentials = {
  readonly username: string
  readonly password: string
}

export type AuthSessionState =
  | { readonly phase: 'checking' }
  | { readonly phase: 'signed-out' }
  | { readonly phase: 'signed-in'; readonly user: AuthenticatedUser }
  | { readonly phase: 'reauth-required'; readonly user: AuthenticatedUser }
  | { readonly phase: 'unavailable' }

export type LoginFailure = 'credentials' | 'unavailable'
