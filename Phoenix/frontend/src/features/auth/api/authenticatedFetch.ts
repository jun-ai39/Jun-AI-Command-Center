import { notifySessionExpired } from './sessionExpiry'

export function authenticatedFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
): Promise<Response> {
  return fetch(input, { ...init, credentials: 'include' }).then((response) => {
    if (response.status === 401) notifySessionExpired()
    return response
  })
}
