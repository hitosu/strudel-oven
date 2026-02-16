const isMac = navigator.platform.startsWith('Mac')
const saveHint = isMac ? '⌘S to save' : 'Ctrl+S to save'

export function StatusBar({ connectionStatus, trackName, message, onShare }) {
  return (
    <div className="status-bar">
      <span className={`status-dot ${connectionStatus}`} />
      <span className="status-text">{message || connectionStatus}</span>
      {trackName && <>
        <button className="share-btn" onClick={onShare}>share on strudel.cc</button>
        <span className="status-hint">{saveHint}</span>
        <span className="status-track">{trackName}</span>
      </>}
    </div>
  )
}
