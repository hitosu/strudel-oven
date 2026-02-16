import { useState, useEffect } from 'react'

export function ShareDialog({ code, onClose }) {
  const [longUrl, setLongUrl] = useState('')
  const [shortUrl, setShortUrl] = useState(null)
  const [shortening, setShortening] = useState(false)
  const [error, setError] = useState(null)
  const [copied, setCopied] = useState(null)

  useEffect(() => {
    if (code != null) {
      setLongUrl(`https://strudel.cc/#${btoa(unescape(encodeURIComponent(code)))}`)
    }
  }, [code])

  const copyToClipboard = async (url, which) => {
    await navigator.clipboard.writeText(url)
    setCopied(which)
    setTimeout(() => setCopied(null), 2000)
  }

  const handleShorten = async () => {
    if (!longUrl) return
    setShortening(true)
    setError(null)
    try {
      const res = await fetch('/api/shorten', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: longUrl }),
      })
      const data = await res.json()
      if (data.shorturl) {
        setShortUrl(data.shorturl)
        await navigator.clipboard.writeText(data.shorturl)
        setCopied('short')
        setTimeout(() => setCopied(null), 2000)
      } else {
        setError(data.error)
      }
    } catch {
      setError('Network error')
    }
    setShortening(false)
  }

  return (
    <div className="track-selector-overlay" onClick={onClose}>
      <div className="share-dialog" onClick={e => e.stopPropagation()}>
        <div className="track-selector-header">
          <span>Share on strudel.cc</span>
          <button onClick={onClose}>×</button>
        </div>
        <div className="share-dialog-body">
          <div className="share-row">
            <input type="text" readOnly value={longUrl} onClick={e => e.target.select()} />
            <button onClick={() => copyToClipboard(longUrl, 'long')}>
              {copied === 'long' ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <div className="share-row">
            {shortUrl ? (
              <>
                <input type="text" readOnly value={shortUrl} onClick={e => e.target.select()} />
                <button onClick={() => copyToClipboard(shortUrl, 'short')}>
                  {copied === 'short' ? 'Copied!' : 'Copy'}
                </button>
              </>
            ) : (
              <>
                <button className="share-shorten-btn" onClick={handleShorten} disabled={shortening}>
                  {shortening ? 'Shortening...' : 'Shorten'}
                </button>
                {error && <span className="share-error">{error}</span>}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
