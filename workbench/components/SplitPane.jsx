import React, { useState, useRef, useCallback } from 'react'

export function SplitPane({ left, right }) {
  const [splitRatio, setSplitRatio] = useState(0.5)
  const containerRef = useRef(null)
  const draggingRef = useRef(false)

  const onMouseDown = useCallback((e) => {
    e.preventDefault()
    draggingRef.current = true

    const onMouseMove = (e) => {
      if (!draggingRef.current || !containerRef.current) return
      const rect = containerRef.current.getBoundingClientRect()
      const ratio = (e.clientX - rect.left) / rect.width
      setSplitRatio(Math.max(0.2, Math.min(0.8, ratio)))
    }

    const onMouseUp = () => {
      draggingRef.current = false
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('mouseup', onMouseUp)
    }

    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('mouseup', onMouseUp)
  }, [])

  return (
    <div className="split-pane" ref={containerRef}>
      <div className="split-left" style={{ flexBasis: `${splitRatio * 100}%` }}>
        {left}
      </div>
      <div className="split-divider" onMouseDown={onMouseDown} />
      <div className="split-right" style={{ flexBasis: `${(1 - splitRatio) * 100}%` }}>
        {right}
      </div>
    </div>
  )
}
