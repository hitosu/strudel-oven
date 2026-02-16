import { useRef, useCallback } from 'react'

export function useTerminal() {
  const sessionsRef = useRef(new Map())

  const createSession = useCallback(async (trackName) => {
    const res = await fetch('/api/terminal/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ trackName }),
    })
    const { sessionId } = await res.json()
    sessionsRef.current.set(sessionId, { trackName })
    return sessionId
  }, [])

  const destroySession = useCallback(async (sessionId) => {
    if (!sessionId) return
    sessionsRef.current.delete(sessionId)
    try {
      await fetch(`/api/terminal/${sessionId}`, { method: 'DELETE' })
    } catch {}
  }, [])

  const getWebSocketUrl = useCallback((sessionId) => {
    const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'
    return `${proto}//${location.host}/ws/terminal/${sessionId}`
  }, [])

  return { createSession, destroySession, getWebSocketUrl }
}
