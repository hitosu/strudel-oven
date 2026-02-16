import { useState, useEffect, useRef, useCallback } from 'react'
import { TabBar } from './components/TabBar'
import { TrackSelector } from './components/TrackSelector'
import { Toolbar } from './components/Toolbar'
import { StrudelPanel } from './components/StrudelPanel'
import { TerminalPanel } from './components/TerminalPanel'
import { SplitPane } from './components/SplitPane'
import { StatusBar } from './components/StatusBar'
import { ShareDialog } from './components/ShareDialog'
import { useTracks } from './hooks/useTracks'
import { useTerminal } from './hooks/useTerminal'

const STORAGE_KEY = 'strudel-workbench-state'

function loadPersistedState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)
  } catch { return null }
}

function savePersistedState(state) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {}
}

let nextId = 1

export default function App() {
  const { tracks, connectionStatus, onFileChange } = useTracks()
  const { createSession, destroySession, getWebSocketUrl } = useTerminal()

  const [tabs, setTabs] = useState([])
  const [activeTabId, setActiveTabId] = useState(null)
  const [showSelector, setShowSelector] = useState(false)
  const [shareCode, setShareCode] = useState(null)
  const [tabStates, setTabStates] = useState({}) // { [tabId]: { isPlaying, sessionId, wsUrl, undoDepth } }
  const [statusMessage, setStatusMessage] = useState(null)
  const statusTimerRef = useRef(null)
  const strudelRefs = useRef({})
  const terminalRefs = useRef({})
  const initializedRef = useRef(false)

  const activeTab = tabs.find(t => t.id === activeTabId)
  const activeState = activeTabId ? tabStates[activeTabId] : null

  // Persist state to localStorage whenever tabs/activeTabId/tabStates change
  useEffect(() => {
    if (!initializedRef.current) return
    const persistedTabs = tabs.map(t => ({
      id: t.id,
      trackName: t.trackName,
    }))
    const persistedStates = {}
    for (const [id, state] of Object.entries(tabStates)) {
      persistedStates[id] = {
        isPlaying: state.isPlaying || false,
      }
    }
    savePersistedState({
      tabs: persistedTabs,
      activeTabId,
      tabStates: persistedStates,
    })
  }, [tabs, activeTabId, tabStates])

  // Restore state from localStorage on mount
  useEffect(() => {
    const saved = loadPersistedState()
    if (saved?.tabs?.length) {
      // Restore tab IDs, bump nextId past the max
      const maxId = Math.max(...saved.tabs.map(t => t.id))
      nextId = maxId + 1
      setTabs(saved.tabs)
      setActiveTabId(saved.activeTabId || saved.tabs[0].id)
      // Restore partial states, verify files exist
      const states = {}
      const checks = saved.tabs.map(tab =>
        fetch(`/api/track?name=${encodeURIComponent(tab.trackName)}`)
          .then(res => ({ tab, exists: res.ok }))
          .catch(() => ({ tab, exists: false }))
      )
      Promise.all(checks).then(results => {
        for (const { tab, exists } of results) {
          const savedState = saved.tabStates?.[tab.id]
          states[tab.id] = {
            isPlaying: savedState?.isPlaying || false,
            sessionId: null,
            wsUrl: null,
            notFound: !exists,
          }
        }
        setTabStates(states)
      })
    }
    initializedRef.current = true
  }, [])

  // Kill all PTY sessions on page close
  useEffect(() => {
    const cleanup = () => {
      for (const state of Object.values(tabStates)) {
        if (state.sessionId) {
          navigator.sendBeacon(`/api/terminal/${state.sessionId}/kill`)
        }
      }
    }
    window.addEventListener('beforeunload', cleanup)
    return () => window.removeEventListener('beforeunload', cleanup)
  }, [tabStates])

  // Create terminal sessions for tabs that don't have one yet (after restore or new tab)
  useEffect(() => {
    for (const tab of tabs) {
      const state = tabStates[tab.id]
      if (state && !state.sessionId && !state._creating && !state.notFound) {
        // Mark as creating to avoid double-creation
        setTabStates(prev => ({
          ...prev,
          [tab.id]: { ...prev[tab.id], _creating: true },
        }))
        createSession(tab.trackName).then(sessionId => {
          const wsUrl = getWebSocketUrl(sessionId)
          setTabStates(prev => ({
            ...prev,
            [tab.id]: { ...prev[tab.id], sessionId, wsUrl, _creating: false },
          }))
        })
      }
    }
  }, [tabs, tabStates, createSession, getWebSocketUrl])

  // Load track content when a strudel panel becomes ready
  const loadedTabsRef = useRef(new Set())
  const handlePanelReady = useCallback((tabId, trackName) => {
    if (loadedTabsRef.current.has(tabId)) return
    loadedTabsRef.current.add(tabId)
    fetch(`/api/track?name=${encodeURIComponent(trackName)}`)
      .then(res => res.ok ? res.text() : null)
      .then(content => {
        if (content == null) return
        const ref = strudelRefs.current[tabId]
        if (ref) ref.setCode(content)
      })
      .catch(() => {})
  }, [])

  // Tracks to skip next SSE update for (after save, editor already has the content)
  const suppressSSERef = useRef(new Set())

  // Refs for values needed inside SSE callback (avoids re-subscribing on every state change)
  const activeTabIdRef = useRef(activeTabId)
  const tabStatesRef = useRef(tabStates)
  activeTabIdRef.current = activeTabId
  tabStatesRef.current = tabStates

  // SSE: subscribe to file changes for all open tabs
  useEffect(() => {
    const cleanups = []
    for (const tab of tabs) {
      const cleanup = onFileChange(tab.trackName, (content, undoDepth) => {
        if (content === null) return // deleted
        setTabStates(prev => ({
          ...prev,
          [tab.id]: { ...prev[tab.id], undoDepth: undoDepth ?? prev[tab.id]?.undoDepth ?? 0 },
        }))
        if (suppressSSERef.current.delete(tab.trackName)) return // skip post-save echo
        const ref = strudelRefs.current[tab.id]
        if (ref) {
          ref.setCode(content)
          // Auto-eval only the active tab when playing
          if (tab.id === activeTabIdRef.current && tabStatesRef.current[tab.id]?.isPlaying) {
            ref.evaluate()
          }
        }
      })
      cleanups.push(cleanup)
    }
    return () => cleanups.forEach(fn => fn())
  }, [tabs, onFileChange])

  // Stop audio on previous tab when switching
  const prevActiveRef = useRef(null)
  useEffect(() => {
    if (prevActiveRef.current && prevActiveRef.current !== activeTabId) {
      const ref = strudelRefs.current[prevActiveRef.current]
      if (ref) ref.stop()
      setTabStates(prev => ({
        ...prev,
        [prevActiveRef.current]: { ...prev[prevActiveRef.current], isPlaying: false },
      }))
    }
    prevActiveRef.current = activeTabId
  }, [activeTabId])

  const handleAddTab = () => setShowSelector(true)

  const handleSelectTrack = async (trackName) => {
    setShowSelector(false)
    const id = nextId++
    const newTab = { id, trackName }
    setTabs(prev => [...prev, newTab])
    setTabStates(prev => ({
      ...prev,
      [id]: { isPlaying: false, sessionId: null, wsUrl: null },
    }))
    setActiveTabId(id)
  }

  const handleCloseTab = async (tabId) => {
    const state = tabStates[tabId]
    // Stop audio
    const ref = strudelRefs.current[tabId]
    if (ref) ref.stop()
    // Kill PTY
    if (state?.sessionId) await destroySession(state.sessionId)

    loadedTabsRef.current.delete(tabId)
    delete strudelRefs.current[tabId]
    delete terminalRefs.current[tabId]
    setTabs(prev => prev.filter(t => t.id !== tabId))
    setTabStates(prev => {
      const next = { ...prev }
      delete next[tabId]
      return next
    })

    if (activeTabId === tabId) {
      setTabs(prev => {
        const remaining = prev.filter(t => t.id !== tabId)
        setActiveTabId(remaining.length ? remaining[remaining.length - 1].id : null)
        return remaining
      })
    }
  }

  const handlePlay = () => {
    const ref = strudelRefs.current[activeTabId]
    if (ref) {
      ref.evaluate()
      setTabStates(prev => ({
        ...prev,
        [activeTabId]: { ...prev[activeTabId], isPlaying: true },
      }))
    }
  }

  const handleStop = () => {
    const ref = strudelRefs.current[activeTabId]
    if (ref) {
      ref.stop()
      setTabStates(prev => ({
        ...prev,
        [activeTabId]: { ...prev[activeTabId], isPlaying: false },
      }))
    }
  }

  const handleSave = useCallback(async () => {
    if (!activeTab) return
    const ref = strudelRefs.current[activeTabId]
    if (!ref) return
    const code = ref.getCode()
    if (code == null) {
      console.warn('Save: could not read code from editor')
      return
    }
    try {
      const res = await fetch(`/api/track?name=${encodeURIComponent(activeTab.trackName)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: code }),
      })
      if (res.ok) {
        suppressSSERef.current.add(activeTab.trackName)
        setStatusMessage('SAVED!')
        clearTimeout(statusTimerRef.current)
        statusTimerRef.current = setTimeout(() => setStatusMessage(null), 5000)
      } else {
        const err = await res.json().catch(() => ({}))
        console.error('Save failed:', err.error || res.statusText)
        alert(err.error || 'Save failed')
      }
    } catch {}
  }, [activeTab, activeTabId])

  const handleUndo = useCallback(async () => {
    if (!activeTab) return
    try {
      const res = await fetch(`/api/track/undo?name=${encodeURIComponent(activeTab.trackName)}`, {
        method: 'POST',
      })
      if (res.ok) {
        const { undoDepth } = await res.json()
        setTabStates(prev => ({
          ...prev,
          [activeTabId]: { ...prev[activeTabId], undoDepth },
        }))
        setStatusMessage('UNDONE!')
        clearTimeout(statusTimerRef.current)
        statusTimerRef.current = setTimeout(() => setStatusMessage(null), 5000)
      }
    } catch {}
  }, [activeTab, activeTabId])

  // Ctrl+S / Cmd+S to save, Ctrl+Z / Cmd+Z to undo
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault()
        handleSave()
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        // Only intercept Ctrl+Z when focus is NOT in the editor (let CM6 handle its own undo)
        const inEditor = e.target.closest?.('.cm-content')
        if (!inEditor) {
          e.preventDefault()
          handleUndo()
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [handleSave, handleUndo])

  return (
    <div className="app">
      <TabBar
        tabs={tabs}
        activeTabId={activeTabId}
        onSelectTab={setActiveTabId}
        onCloseTab={handleCloseTab}
        onAddTab={handleAddTab}
      />
      {activeTab && activeState && (
        <Toolbar
          isPlaying={activeState.isPlaying}
          undoDepth={activeState.undoDepth || 0}
          onPlay={handlePlay}
          onStop={handleStop}
          onUndo={handleUndo}
        />
      )}
      <div className="panels">
        {tabs.map(tab => (
          <div key={tab.id} className="tab-content" style={{ display: tab.id === activeTabId ? 'flex' : 'none' }}>
            {tabStates[tab.id]?.notFound ? (
              <div className="empty-state">
                <p>File not found: {tab.trackName}</p>
                <button onClick={() => handleCloseTab(tab.id)}>Close tab</button>
              </div>
            ) : (
              <SplitPane
                left={
                  <StrudelPanel
                    ref={el => { if (el) strudelRefs.current[tab.id] = el }}
                    onReady={() => handlePanelReady(tab.id, tab.trackName)}
                    onError={(msg) => {
                      const term = terminalRefs.current[tab.id]
                      if (term) term.sendInput(`REPL error: ${msg}`)
                    }}
                  />
                }
                right={
                  <TerminalPanel
                    ref={el => { if (el) terminalRefs.current[tab.id] = el }}
                    sessionId={tabStates[tab.id]?.sessionId}
                    wsUrl={tabStates[tab.id]?.wsUrl}
                    visible={tab.id === activeTabId}
                  />
                }
              />
            )}
          </div>
        ))}
        {tabs.length === 0 && (
          <div className="empty-state">
            <p>No tracks open</p>
            <button onClick={handleAddTab}>+ Open a track</button>
          </div>
        )}
      </div>
      <StatusBar connectionStatus={connectionStatus} trackName={activeTab?.trackName} message={statusMessage} onShare={() => {
        const ref = strudelRefs.current[activeTabId]
        if (ref) setShareCode(ref.getCode())
      }} />
      {showSelector && (
        <TrackSelector
          tracks={tracks}
          onSelect={handleSelectTrack}
          onCreate={handleSelectTrack}
          onClose={() => setShowSelector(false)}
        />
      )}
      {shareCode != null && (
        <ShareDialog code={shareCode} onClose={() => setShareCode(null)} />
      )}
    </div>
  )
}
