export type HealthResponse = {
  readonly status: 'ok'
  readonly service: 'phoenix-api'
  readonly version: string
}

export type HealthConnectionState =
  | { readonly phase: 'loading' }
  | { readonly phase: 'online'; readonly health: HealthResponse }
  | { readonly phase: 'offline' }
