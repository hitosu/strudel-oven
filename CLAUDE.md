# Strudel Local Workbench

Local browser-based player for `.strudel` music files with hot reload, tabbed editing, and embedded Claude Code terminal.

## Quick Start

```
npm install
npm run dev
# → Vite: http://localhost:5173  Backend: http://localhost:5742
```

Open http://localhost:5173, click "+", select a track. REPL on left, Claude Code terminal on right.

Production: `npm run build && npm start`

## Project Structure

```
package.json          ← dependencies + scripts
vite.config.js        ← Vite config with proxy to backend
index.html            ← Vite HTML entry (loads strudel-editor CDN script)
server/
  index.js            ← Express + ws + node-pty + SSE + track API
workbench/            ← UI source code
  main.jsx            ← React entry
  App.jsx             ← Layout: TabBar + active tab content + localStorage persistence
  components/
    TabBar.jsx        ← Tab strip with + button, close buttons
    TrackSelector.jsx ← Modal listing available tracks
    StrudelPanel.jsx  ← Wraps <strudel-editor> web component
    TerminalPanel.jsx ← Wraps xterm.js + WebSocket to PTY
    Toolbar.jsx       ← Play/Stop, eval-on-change toggle
    SplitPane.jsx     ← Draggable horizontal split
    StatusBar.jsx     ← SSE connection status + current track + save confirmation
  hooks/
    useTracks.js      ← SSE connection, track list, file change events
    useTerminal.js    ← PTY session lifecycle (create/connect/destroy)
  styles/
    index.css         ← Dark theme, layout
tracks/               ← .strudel files go here
```

## Architecture

- **Vite + React** frontend with HMR in dev mode
- **Express backend** with WebSocket (node-pty) for Claude Code terminals
- **Hot reload via SSE:** `fs.watch` on `tracks/` → 300ms debounce → SSE broadcast → browser updates
- **Tab system:** Each tab = track REPL + dedicated Claude Code PTY session
- **localStorage persistence:** Open tabs, active tab, and play state restored on reload
- **Ctrl+S / Cmd+S** saves current REPL content to disk via `PUT /api/track`. Shows "SAVED!" in status bar for 5s.
- **CC session persistence:** Each track gets a Claude Code session ID stored in `.claude-sessions.json`. Sessions resume on reopen via `claude --resume`.
- **PTY cleanup:** WebSocket close kills PTY. 15s timeout kills orphaned sessions. `SIGINT`/`SIGTERM` kills all. `beforeunload` sends beacon.
- **Default ports:** Backend 5742, Vite dev 5173 (proxies `/api/*` and `/ws/*` to backend)

## API Routes

- `GET /api/tracks` — JSON array of `.strudel` filenames
- `GET /api/track?name=<file>` — raw text content (path traversal guarded)
- `PUT /api/track?name=<file>` — save track content `{ content: "..." }`
- `GET /api/events` — SSE stream (`change`, `delete`, `tracklist` events)
- `POST /api/terminal/create` — spawn Claude Code PTY (resumes if session exists in `.claude-sessions.json`), returns `{ sessionId }`
- `DELETE /api/terminal/:sessionId` — kill PTY session
- `POST /api/terminal/:sessionId/kill` — kill PTY (sendBeacon-friendly)
- `ws://*/ws/terminal/:sessionId` — bidirectional WebSocket for terminal I/O

## Conventions

- All music files use `.strudel` extension and live in `tracks/`.
- `samples()` calls in `.strudel` files fetch from GitHub CDN directly.
- `<strudel-editor>` web component loaded via CDN script tag, not npm.
