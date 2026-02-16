import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'node-pty';
import crypto from 'crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, '..'); // repo root
const TRACKS_DIR = path.join(PROJECT_ROOT, 'tracks');
fs.mkdirSync(TRACKS_DIR, { recursive: true });
const DIST_DIR = path.join(PROJECT_ROOT, 'dist');
const PORT = process.env.PORT || 5742;
const DEBOUNCE_MS = 300;

const app = express();
app.use(express.json());

// --- SSE ---
const sseClients = new Set();

function broadcast(data) {
  const msg = `data: ${JSON.stringify(data)}\n\n`;
  for (const res of sseClients) res.write(msg);
}

// --- Track helpers ---
function listTracks(dir = TRACKS_DIR, prefix = '') {
  try {
    const results = [];
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (entry.isDirectory()) {
        results.push(...listTracks(path.join(dir, entry.name), rel));
      } else if (entry.name.endsWith('.strudel')) {
        results.push(rel);
      }
    }
    return results.sort();
  } catch { return []; }
}

function isValidName(name) {
  return name
    && !name.includes('\\')
    && !name.includes('..')
    && !name.startsWith('/')
    && name.endsWith('.strudel');
}

// --- File history (undo support) ---
const fileHistory = new Map(); // trackName -> [content, content, ...]
const suppressWatcher = new Set(); // tracks to skip next watcher event for

function pushHistory(name, content) {
  if (!fileHistory.has(name)) fileHistory.set(name, []);
  const stack = fileHistory.get(name);
  // Don't push if identical to the top
  if (stack.length && stack[stack.length - 1] === content) return;
  stack.push(content);
}

function getUndoDepth(name) {
  const stack = fileHistory.get(name);
  return stack ? Math.max(0, stack.length - 1) : 0;
}

// Snapshot initial state of all tracks
for (const name of listTracks()) {
  try {
    const content = fs.readFileSync(path.join(TRACKS_DIR, name), 'utf8');
    pushHistory(name, content);
  } catch {}
}

// --- File watcher (recursive) ---
const debounceTimers = new Map();

function handleFileChange(relName) {
  if (!relName || !relName.endsWith('.strudel')) return;
  if (debounceTimers.has(relName)) clearTimeout(debounceTimers.get(relName));

  debounceTimers.set(relName, setTimeout(() => {
    debounceTimers.delete(relName);
    const filePath = path.join(TRACKS_DIR, relName);
    const tracks = listTracks();

    if (suppressWatcher.delete(relName)) {
      broadcast({ type: 'tracklist', tracks });
      return;
    }

    try {
      const content = fs.readFileSync(filePath, 'utf8');
      pushHistory(relName, content);
      broadcast({ type: 'change', name: relName, content, undoDepth: getUndoDepth(relName) });
    } catch {
      broadcast({ type: 'delete', name: relName });
      fileHistory.delete(relName);
    }
    broadcast({ type: 'tracklist', tracks });
  }, DEBOUNCE_MS));
}

// Watch each directory individually (fs.watch recursive is unreliable on WSL/Linux)
const activeWatchers = new Map();

function watchDir(dir, prefix = '') {
  if (activeWatchers.has(dir)) return;
  try {
    const watcher = fs.watch(dir, (eventType, filename) => {
      if (!filename) return;
      const relName = prefix ? `${prefix}/${filename}` : filename;
      const fullPath = path.join(dir, filename);
      // If a new subdirectory appeared, watch it too
      try {
        if (fs.statSync(fullPath).isDirectory()) {
          watchDir(fullPath, relName);
          return;
        }
      } catch {}
      handleFileChange(relName);
    });
    activeWatchers.set(dir, watcher);
  } catch {}
}

// Watch tracks root + all existing subdirectories
function watchAllDirs(dir = TRACKS_DIR, prefix = '') {
  watchDir(dir, prefix);
  try {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.isDirectory()) {
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        watchAllDirs(path.join(dir, entry.name), rel);
      }
    }
  } catch {}
}

watchAllDirs();

// --- Track API ---
app.get('/api/tracks', (req, res) => {
  res.json(listTracks());
});

app.get('/api/track', (req, res) => {
  const name = req.query.name;
  if (!isValidName(name)) return res.status(400).send('Invalid track name');
  const filePath = path.join(TRACKS_DIR, name);
  fs.readFile(filePath, 'utf8', (err, data) => {
    if (err) return res.status(404).send('Track not found');
    res.type('text/plain').send(data);
  });
});

app.post('/api/track/undo', (req, res) => {
  const name = req.query.name;
  if (!isValidName(name)) return res.status(400).send('Invalid track name');
  const stack = fileHistory.get(name);
  if (!stack || stack.length <= 1) return res.status(404).json({ error: 'Nothing to undo' });

  stack.pop(); // remove current version
  const previous = stack[stack.length - 1];
  const filePath = path.join(TRACKS_DIR, name);

  suppressWatcher.add(name); // don't re-push this to history
  fs.writeFile(filePath, previous, 'utf8', (err) => {
    if (err) return res.status(500).send('Failed to write');
    broadcast({ type: 'change', name, content: previous, undoDepth: getUndoDepth(name) });
    res.json({ ok: true, undoDepth: getUndoDepth(name) });
  });
});

app.post('/api/track/create', (req, res) => {
  let name = req.body.name;
  if (!name) return res.status(400).json({ error: 'Missing name' });
  if (!name.endsWith('.strudel')) name += '.strudel';
  if (!isValidName(name)) return res.status(400).json({ error: 'Invalid track name' });
  const filePath = path.join(TRACKS_DIR, name);
  if (fs.existsSync(filePath)) return res.status(409).json({ error: 'Track already exists' });
  // Create subdirectories if needed
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  const baseName = path.basename(name, '.strudel');
  const starter = `// ${baseName}\n`;
  fs.writeFile(filePath, starter, 'utf8', (err) => {
    if (err) return res.status(500).json({ error: 'Failed to create' });
    res.json({ ok: true, name });
  });
});

app.put('/api/track', (req, res) => {
  const name = req.query.name;
  if (!isValidName(name)) return res.status(400).send('Invalid track name');
  const filePath = path.join(TRACKS_DIR, name);
  const content = req.body.content;
  if (typeof content !== 'string') return res.status(400).send('Missing content');
  fs.writeFile(filePath, content, 'utf8', (err) => {
    if (err) return res.status(500).send('Failed to save');
    res.json({ ok: true });
  });
});

app.post('/api/shorten', async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).json({ error: 'Missing url' });
  try {
    const resp = await fetch('https://da.gd/s', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `url=${encodeURIComponent(url)}`,
    });
    const text = (await resp.text()).trim();
    if (text.startsWith('http')) return res.json({ shorturl: text });
    res.status(502).json({ error: text || 'Shortening failed' });
  } catch (e) {
    res.status(502).json({ error: e.message });
  }
});

app.get('/api/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write('\n');
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));

  const keepalive = setInterval(() => res.write(': keepalive\n\n'), 30000);
  req.on('close', () => clearInterval(keepalive));

  res.write(`data: ${JSON.stringify({ type: 'tracklist', tracks: listTracks() })}\n\n`);
});

// --- Claude Code session persistence ---
const CC_SESSIONS_FILE = path.join(PROJECT_ROOT, '.claude-sessions.json');

function loadCCSessions() {
  try {
    return JSON.parse(fs.readFileSync(CC_SESSIONS_FILE, 'utf8'));
  } catch { return {}; }
}

function saveCCSessions(map) {
  fs.writeFileSync(CC_SESSIONS_FILE, JSON.stringify(map, null, 2));
}

// --- Terminal (PTY) management ---
const sessions = new Map();

app.post('/api/terminal/create', (req, res) => {
  const { trackName } = req.body;
  const sessionId = crypto.randomUUID();
  const trackRelPath = trackName && isValidName(trackName)
    ? path.join('tracks', trackName)
    : undefined;

  // Look up or create a persistent Claude Code session ID for this track
  const ccSessions = loadCCSessions();
  const existingCCSessionId = trackName ? ccSessions[trackName] : null;

  let args;
  if (existingCCSessionId) {
    // Resume existing CC session
    args = ['--resume', existingCCSessionId];
  } else if (trackRelPath) {
    // New session with a known ID so we can resume later
    const newCCSessionId = crypto.randomUUID();
    // Check if track is new (small file = just created with starter comment)
    let isNew = false;
    try {
      const stat = fs.statSync(path.join(TRACKS_DIR, trackName));
      isNew = stat.size < 50;
    } catch {}
    const prompt = isNew
      ? `Read strudel-guide.md for reference. The file ${trackRelPath} is a newly created empty track. Ask me what kind of music I want to create before writing anything.`
      : `Read strudel-guide.md for reference, then read ${trackRelPath} and help me edit this Strudel track.`;
    args = ['--session-id', newCCSessionId, prompt];
    if (trackName) {
      ccSessions[trackName] = newCCSessionId;
      saveCCSessions(ccSessions);
    }
  } else {
    args = [];
  }

  const pty = spawn('claude', args, {
    name: 'xterm-256color',
    cols: 80,
    rows: 24,
    cwd: PROJECT_ROOT,
    env: { ...process.env, TERM: 'xterm-256color', CLAUDECODE: '' },
  });

  // Kill PTY if no WebSocket connects within 15s (e.g. HMR reload race)
  const wsTimeout = setTimeout(() => {
    const s = sessions.get(sessionId);
    if (s && !s.ws) {
      console.log(`Session ${sessionId}: no WS after 15s, killing PTY`);
      try { s.pty.kill(); } catch {}
      sessions.delete(sessionId);
    }
  }, 15000);

  sessions.set(sessionId, { pty, ws: null, wsTimeout });

  pty.onExit(() => {
    const session = sessions.get(sessionId);
    if (session) {
      clearTimeout(session.wsTimeout);
      if (session.ws) try { session.ws.close(); } catch {}
    }
    sessions.delete(sessionId);
  });

  res.json({ sessionId });
});

app.delete('/api/terminal/:sessionId', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  try { session.pty.kill(); } catch {}
  if (session.ws) try { session.ws.close(); } catch {}
  sessions.delete(req.params.sessionId);
  res.json({ ok: true });
});

// POST endpoint for sendBeacon (beforeunload cleanup)
app.post('/api/terminal/:sessionId/kill', (req, res) => {
  const session = sessions.get(req.params.sessionId);
  if (session) {
    try { session.pty.kill(); } catch {}
    if (session.ws) try { session.ws.close(); } catch {}
    sessions.delete(req.params.sessionId);
  }
  res.status(204).end();
});

// --- Static serving (production) ---
if (process.env.NODE_ENV === 'production') {
  app.use(express.static(DIST_DIR));
  app.get('*', (req, res) => {
    res.sendFile(path.join(DIST_DIR, 'index.html'));
  });
}

// --- HTTP + WebSocket server ---
const server = createServer(app);

const wss = new WebSocketServer({ noServer: true });

server.on('upgrade', (req, socket, head) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const match = url.pathname.match(/^\/ws\/terminal\/(.+)$/);
  if (!match) {
    socket.destroy();
    return;
  }

  const sessionId = match[1];
  const session = sessions.get(sessionId);
  if (!session) {
    socket.destroy();
    return;
  }

  wss.handleUpgrade(req, socket, head, (ws) => {
    session.ws = ws;
    clearTimeout(session.wsTimeout);

    session.pty.onData((data) => {
      if (ws.readyState === ws.OPEN) ws.send(data);
    });

    ws.on('message', (msg) => {
      // Try parsing as JSON for resize commands
      if (msg[0] === 0x7b) { // starts with '{'
        try {
          const parsed = JSON.parse(msg.toString());
          if (parsed.type === 'resize' && parsed.cols && parsed.rows) {
            session.pty.resize(parsed.cols, parsed.rows);
            return;
          }
        } catch {}
      }
      session.pty.write(msg.toString());
    });

    ws.on('close', () => {
      session.ws = null;
      // Kill PTY when WebSocket disconnects (page close, tab close)
      try { session.pty.kill(); } catch {}
      sessions.delete(sessionId);
    });
  });
});

// --- Kill all PTYs on server shutdown (covers node --watch restarts) ---
function killAllSessions() {
  for (const [id, session] of sessions) {
    clearTimeout(session.wsTimeout);
    try { session.pty.kill(); } catch {}
    if (session.ws) try { session.ws.close(); } catch {}
    sessions.delete(id);
  }
}

process.on('SIGINT', () => { killAllSessions(); process.exit(); });
process.on('SIGTERM', () => { killAllSessions(); process.exit(); });
process.on('exit', killAllSessions);

server.listen(PORT, () => {
  console.log(`Strudel backend: http://localhost:${PORT}`);
});
