const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path = require('path');
const fs = require('fs');
const https = require('https');
const http = require('http');

let mainWindow;

// Where we persist settings (API keys, model choice, etc) between launches.
const CONFIG_PATH = path.join(app.getPath('userData'), 'scribewell-config.json');

function loadConfig() {
  try {
    return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
  } catch {
    return {
      backend: 'openrouter', // 'openrouter' | 'ollama'
      openrouterKey: '',
      openrouterModel: 'openai/gpt-4o-mini',
      ollamaUrl: 'http://localhost:11434',
      ollamaModel: 'llama3.1',
      pauseDelayMs: 2500,
      customPrompts: []
    };
  }
}

function saveConfig(cfg) {
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(cfg, null, 2), 'utf-8');
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1500,
    height: 950,
    minWidth: 1000,
    minHeight: 650,
    backgroundColor: '#1a1410',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    titleBarStyle: 'hiddenInset'
  });

  mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ---- IPC: config ----
ipcMain.handle('config:get', () => loadConfig());
ipcMain.handle('config:set', (_evt, cfg) => {
  saveConfig(cfg);
  return cfg;
});

// ---- IPC: file save/open for manuscripts ----
ipcMain.handle('doc:save', async (_evt, { content, suggestedName }) => {
  const { filePath, canceled } = await dialog.showSaveDialog(mainWindow, {
    defaultPath: suggestedName || 'manuscript.txt',
    filters: [{ name: 'Text', extensions: ['txt', 'md'] }]
  });
  if (canceled || !filePath) return null;
  fs.writeFileSync(filePath, content, 'utf-8');
  return filePath;
});

ipcMain.handle('doc:open', async () => {
  const { filePaths, canceled } = await dialog.showOpenDialog(mainWindow, {
    filters: [{ name: 'Text', extensions: ['txt', 'md'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths.length) return null;
  const content = fs.readFileSync(filePaths[0], 'utf-8');
  return { content, path: filePaths[0] };
});

// ---- IPC: AI calls (OpenRouter or Ollama), run from main process to avoid CORS ----
function postJson(urlStr, headers, bodyObj) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlStr);
    const lib = url.protocol === 'https:' ? https : http;
    const body = JSON.stringify(bodyObj);
    const req = lib.request(
      {
        hostname: url.hostname,
        port: url.port || (url.protocol === 'https:' ? 443 : 80),
        path: url.pathname + (url.search || ''),
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(body),
          ...headers
        }
      },
      (res) => {
        let data = '';
        res.on('data', (chunk) => (data += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode, json: JSON.parse(data) });
          } catch (e) {
            resolve({ status: res.statusCode, json: null, raw: data });
          }
        });
      }
    );
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

ipcMain.handle('ai:complete', async (_evt, { systemPrompt, userPrompt }) => {
  const cfg = loadConfig();

  try {
    if (cfg.backend === 'ollama') {
      const result = await postJson(`${cfg.ollamaUrl.replace(/\/$/, '')}/api/chat`, {}, {
        model: cfg.ollamaModel,
        stream: false,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ]
      });
      if (result.status !== 200) {
        return { error: `Ollama error (${result.status}): ${JSON.stringify(result.json || result.raw)}` };
      }
      const text = result.json?.message?.content || '';
      return { text };
    } else {
      if (!cfg.openrouterKey) {
        return { error: 'No OpenRouter API key set. Add one in Settings.' };
      }
      const result = await postJson(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          Authorization: `Bearer ${cfg.openrouterKey}`,
          'HTTP-Referer': 'https://scribewell.local',
          'X-Title': 'Scribewell'
        },
        {
          model: cfg.openrouterModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ]
        }
      );
      if (result.status !== 200) {
        return { error: `OpenRouter error (${result.status}): ${JSON.stringify(result.json || result.raw)}` };
      }
      const text = result.json?.choices?.[0]?.message?.content || '';
      return { text };
    }
  } catch (err) {
    return { error: `Request failed: ${err.message}` };
  }
});
