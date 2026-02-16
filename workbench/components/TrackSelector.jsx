import { useState } from 'react'

function buildTree(tracks) {
  const root = { folders: {}, files: [] }
  for (const track of tracks) {
    const parts = track.split('/')
    let node = root
    for (let i = 0; i < parts.length - 1; i++) {
      if (!node.folders[parts[i]]) node.folders[parts[i]] = { folders: {}, files: [] }
      node = node.folders[parts[i]]
    }
    node.files.push(track)
  }
  return root
}

function FolderNode({ name, node, onSelect, depth = 0 }) {
  const [open, setOpen] = useState(false)
  const folderNames = Object.keys(node.folders).sort()
  const hasContent = node.files.length > 0 || folderNames.length > 0

  if (!hasContent) return null

  return (
    <div>
      <button
        className="track-selector-folder"
        style={{ paddingLeft: 12 + depth * 16 }}
        onClick={() => setOpen(!open)}
      >
        <span className="folder-arrow">{open ? '▾' : '▸'}</span>
        {name}/
      </button>
      {open && (
        <div>
          {folderNames.map(f => (
            <FolderNode key={f} name={f} node={node.folders[f]} onSelect={onSelect} depth={depth + 1} />
          ))}
          {node.files.map(t => (
            <button key={t} className="track-selector-item" style={{ paddingLeft: 12 + (depth + 1) * 16 }} onClick={() => onSelect(t)}>
              {t.split('/').pop().replace(/\.strudel$/, '')}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export function TrackSelector({ tracks, onSelect, onCreate, onClose }) {
  const [newName, setNewName] = useState('')
  const [error, setError] = useState(null)
  const tree = buildTree(tracks)
  const folderNames = Object.keys(tree.folders).sort()

  const handleCreate = async () => {
    const name = newName.trim()
    if (!name) return
    setError(null)
    try {
      const res = await fetch('/api/track/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name }),
      })
      const data = await res.json()
      if (res.ok) {
        onCreate(data.name)
      } else {
        setError(data.error || 'Failed to create')
      }
    } catch {
      setError('Network error')
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleCreate()
  }

  return (
    <div className="track-selector-overlay" onClick={onClose}>
      <div className="track-selector" onClick={e => e.stopPropagation()}>
        <div className="track-selector-header">
          <span>Select a track</span>
          <button onClick={onClose}>×</button>
        </div>
        <div className="track-selector-create">
          <input
            type="text"
            placeholder="New track name (e.g. ambient/pad)"
            value={newName}
            onChange={e => { setNewName(e.target.value); setError(null) }}
            onKeyDown={handleKeyDown}
            autoFocus
          />
          <button onClick={handleCreate}>Create</button>
          {error && <div className="track-selector-error">{error}</div>}
        </div>
        <div className="track-selector-list">
          {folderNames.map(f => (
            <FolderNode key={f} name={f} node={tree.folders[f]} onSelect={onSelect} />
          ))}
          {tree.files.map(t => (
            <button key={t} className="track-selector-item" onClick={() => onSelect(t)}>
              {t.replace(/\.strudel$/, '')}
            </button>
          ))}
          {tracks.length === 0 && (
            <div className="track-selector-empty">No tracks found in tracks/</div>
          )}
        </div>
      </div>
    </div>
  )
}
