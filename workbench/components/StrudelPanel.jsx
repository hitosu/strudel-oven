import { useEffect, useRef, useImperativeHandle, forwardRef, useState } from 'react'

function getCode(editor, container) {
  // Try strudel editor internals
  if (editor?.getCode) return editor.getCode()
  if (typeof editor?.code === 'string') return editor.code
  // Try accessing CM6 view through editor object
  if (editor?.view?.state?.doc) return editor.view.state.doc.toString()
  if (editor?.editorView?.state?.doc) return editor.editorView.state.doc.toString()
  // Try CM6 view via DOM (.cm-editor element stores it)
  const cmEditor = container?.querySelector('.cm-editor')
  if (cmEditor?.cmView?.view?.state?.doc) return cmEditor.cmView.view.state.doc.toString()
  return null
}

export const StrudelPanel = forwardRef(function StrudelPanel({ onReady, onError }, ref) {
  const containerRef = useRef(null)
  const editorRef = useRef(null)
  const onErrorRef = useRef(onError)
  onErrorRef.current = onError
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const el = document.createElement('strudel-editor')
    containerRef.current.appendChild(el)

    const start = Date.now()
    const poll = setInterval(() => {
      if (el.editor) {
        clearInterval(poll)
        editorRef.current = el.editor
        setReady(true)
        if (onReady) onReady()
      } else if (Date.now() - start > 15000) {
        clearInterval(poll)
        console.error('strudel-editor init timeout')
      }
    }, 200)

    // Intercept console.error to catch strudel evaluation errors
    const origConsoleError = console.error
    console.error = (...args) => {
      origConsoleError(...args)
      if (!onErrorRef.current) return
      const msg = args.map(a => a instanceof Error ? a.message : String(a)).join(' ')
      // Filter for strudel parse/eval errors (ignore noisy internal stuff)
      if (msg.includes('Unexpected token') || msg.includes('SyntaxError') ||
          msg.includes('is not defined') || msg.includes('is not a function') ||
          msg.includes('Cannot read') || msg.includes('TypeError') ||
          msg.includes('ReferenceError')) {
        onErrorRef.current(msg.split('\n')[0])
      }
    }

    return () => {
      clearInterval(poll)
      console.error = origConsoleError
      if (editorRef.current) {
        try { editorRef.current.stop() } catch {}
      }
      el.remove()
      const sibling = containerRef.current?.querySelector('strudel-editor + div')
      if (sibling) sibling.remove()
    }
  }, [])

  useImperativeHandle(ref, () => ({
    evaluate: () => {
      try { globalThis.getAudioContext?.()?.resume() } catch {}
      editorRef.current?.evaluate()
    },
    stop: () => {
      editorRef.current?.stop()
      try { globalThis.hush?.() } catch {}
      // Suspend AudioContext to kill in-flight audio (resumes on next evaluate)
      try { globalThis.getAudioContext?.()?.suspend() } catch {}
    },
    setCode: (c) => editorRef.current?.setCode(c),
    getCode: () => getCode(editorRef.current, containerRef.current),
  }), [ready])

  return <div className="strudel-panel" ref={containerRef} />
})
