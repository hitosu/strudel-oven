import { useEffect, useRef, useImperativeHandle, forwardRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

export const TerminalPanel = forwardRef(function TerminalPanel({ sessionId, wsUrl, visible }, ref) {
  const containerRef = useRef(null)
  const termRef = useRef(null)
  const fitRef = useRef(null)
  const wsRef = useRef(null)

  useImperativeHandle(ref, () => ({
    sendInput: (text) => {
      const ws = wsRef.current
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(text)
        setTimeout(() => ws.send('\r'), 200)
      }
    },
  }))

  useEffect(() => {
    if (!sessionId || !wsUrl) return

    const term = new Terminal({
      cursorBlink: true,
      fontSize: 14,
      fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', monospace",
      theme: {
        background: '#1a1a2e',
        foreground: '#e0e0e0',
        cursor: '#e94560',
      },
    })
    const fit = new FitAddon()
    term.loadAddon(fit)
    term.open(containerRef.current)
    fit.fit()

    termRef.current = term
    fitRef.current = fit

    const ws = new WebSocket(wsUrl)
    ws.binaryType = 'arraybuffer'
    wsRef.current = ws

    ws.onopen = () => {
      // Send initial size
      ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
    }

    ws.onmessage = (e) => {
      const data = typeof e.data === 'string' ? e.data : new TextDecoder().decode(e.data)
      term.write(data)
    }

    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data)
    })

    // Handle Ctrl+V paste — read text from clipboard and send to PTY
    term.attachCustomKeyEventHandler((e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'v' && e.type === 'keydown') {
        navigator.clipboard.readText().then(text => {
          if (text && ws.readyState === WebSocket.OPEN) ws.send(text)
        }).catch(() => {})
        return false // prevent xterm default handling
      }
      return true
    })

    ws.onclose = () => {
      term.write('\r\n\x1b[90m--- Session closed ---\x1b[0m\r\n')
    }

    // Resize handling
    const ro = new ResizeObserver(() => {
      fit.fit()
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'resize', cols: term.cols, rows: term.rows }))
      }
    })
    ro.observe(containerRef.current)

    return () => {
      ro.disconnect()
      ws.close()
      term.dispose()
    }
  }, [sessionId, wsUrl])

  // Re-fit when visibility changes
  useEffect(() => {
    if (visible && fitRef.current) {
      // Small delay to let layout settle
      setTimeout(() => fitRef.current.fit(), 50)
    }
  }, [visible])

  return <div className="terminal-panel" ref={containerRef} />
})
