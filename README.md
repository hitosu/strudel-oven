# strudel-oven

Local browser-based workbench for [Strudel](https://strudel.cc/) music files. Write live-coded music in a tabbed REPL with an embedded Claude Code terminal alongside for AI-assisted composition.

![strudel-oven screenshot](https://github.com/user-attachments/assets/c230d6d4-9a19-4415-9b7b-26104802888e)

## Prerequisites

- **Node.js** 18+
- **[Claude Code CLI](https://docs.anthropic.com/en/docs/claude-code)** installed and configured (`claude` must be available in your PATH)

## Setup

```bash
npm install
npm run dev
```

Vite dev server starts at http://localhost:5173, backend at http://localhost:5742.

Open the browser, click "+", select a track. REPL on the left, Claude Code terminal on the right.

## Production

```bash
npm run build
npm start
```

## How It Works

- Each tab is a `.strudel` track file paired with a dedicated Claude Code terminal session
- Tracks live in the `tracks/` directory (not tracked by git — bring your own)
- Hot reload: editing a track file on disk updates the REPL in the browser automatically
- **Ctrl+S / Cmd+S** saves REPL content back to disk
- Claude Code sessions persist across tab reopens via session IDs

## Project Structure

```
server/
  index.js            Express + WebSocket + node-pty + SSE
workbench/
  main.jsx            React entry
  App.jsx             Layout + tab persistence
  components/         TabBar, StrudelPanel, TerminalPanel, etc.
  hooks/              useTracks (SSE), useTerminal (PTY lifecycle)
  styles/             Dark theme
tracks/               .strudel files (gitignored)
```
