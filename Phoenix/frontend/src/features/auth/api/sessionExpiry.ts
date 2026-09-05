type SessionExpiredListener = () => void

const sessionExpiredListeners = new Set<SessionExpiredListener>()

export function notifySessionExpired(): void {
  sessionExpiredListeners.forEach((listener) => listener())
}

export function subscribeToSessionExpiry(
  listener: SessionExpiredListener,
): () => void {
  sessionExpiredListeners.add(listener)
  return () => sessionExpiredListeners.delete(listener)
}
