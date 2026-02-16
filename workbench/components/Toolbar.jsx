export function Toolbar({ isPlaying, undoDepth, onPlay, onStop, onUndo }) {
  return (
    <div className="toolbar">
      <button className={isPlaying ? 'active' : ''} onClick={onPlay}>Play</button>
      <button onClick={onStop}>Stop</button>
      <button className="undo-btn" disabled={!undoDepth} onClick={onUndo}>
        Undo{undoDepth > 0 ? ` (${undoDepth})` : ''}
      </button>
    </div>
  )
}
