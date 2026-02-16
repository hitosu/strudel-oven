import { useState, useEffect, useRef, useCallback } from 'react'

export function useTracks() {
  const [tracks, setTracks] = useState([])
  const [connectionStatus, setConnectionStatus] = useState('disconnected')
  const changeCallbacksRef = useRef(new Map())

  const onFileChange = useCallback((trackName, callback) => {
    changeCallbacksRef.current.set(trackName, callback)
    return () => changeCallbacksRef.current.delete(trackName)
  }, [])

  useEffect(() => {
    let evtSource
    let reconnectTimer

    function connect() {
      evtSource = new EventSource('/api/events')

      evtSource.onopen = () => setConnectionStatus('connected')

      evtSource.onmessage = (e) => {
        let data
        try { data = JSON.parse(e.data) } catch { return }

        if (data.type === 'tracklist') {
          setTracks(data.tracks)
        }

        if (data.type === 'change') {
          const cb = changeCallbacksRef.current.get(data.name)
          if (cb) cb(data.content, data.undoDepth ?? 0)
        }

        if (data.type === 'delete') {
          const cb = changeCallbacksRef.current.get(data.name)
          if (cb) cb(null)
        }
      }

      evtSource.onerror = () => {
        setConnectionStatus('disconnected')
        evtSource.close()
        reconnectTimer = setTimeout(connect, 3000)
      }
    }

    connect()
    return () => {
      if (evtSource) evtSource.close()
      if (reconnectTimer) clearTimeout(reconnectTimer)
    }
  }, [])

  return { tracks, connectionStatus, onFileChange }
}
