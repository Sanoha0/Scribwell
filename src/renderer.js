// ============ State ============
let config = null;
let pauseTimer = null;
let lastAnalyzedLength = 0;
let storyMemory = ''; // running summary the AI maintains about the manuscript
let feedItems = [];

const editor = document.getElementById('editor');
const wordCountEl = document.getElementById('wordCount');
const feedList = document.getElementById('feedList');
const toastStack = document.getElementById('toastStack');
const statusDot = document.getElementById('statusDot');

const ICONS = {
  foreshadowing: '🕯',
  grammar: '✒',
  continuity: '📖',
  character: '🎭',
  note: '🖋'
};

const LABELS = {
  foreshadowing: 'Foreshadowing',
  grammar: 'Grammar & Style',
  continuity: 'Continuity',
  character: 'Character',
  note: 'Note'
};

// ============ Init ============
init();

async function init() {
  config = await window.scribewell.getConfig();
  applyConfigToUI();
  wireUpUI();
  editor.focus();
}

function applyConfigToUI() {
  document.getElementById('openrouterKey').value = config.openrouterKey || '';
  document.getElementById('openrouterModel').value = config.openrouterModel || 'openai/gpt-4o-mini';
  document.getElementById('ollamaUrl').value = config.ollamaUrl || 'http://localhost:11434';
  document.getElementById('ollamaModel').value = config.ollamaModel || 'llama3.1';
  document.getElementById('pauseDelay').value = config.pauseDelayMs || 2500;
  document.getElementById('customPrompts').value = (config.customPrompts || []).join('\n');
  setBackendUI(config.backend || 'openrouter');
  updatePauseLabel();
}

function setBackendUI(backend) {
  document.getElementById('optOpenrouter').classList.toggle('active', backend === 'openrouter');
  document.getElementById('optOllama').classList.toggle('active', backend === 'ollama');
  document.getElementById('openrouterFields').style.display = backend === 'openrouter' ? '' : 'none';
  document.getElementById('ollamaFields').style.display = backend === 'ollama' ? '' : 'none';
}

function updatePauseLabel() {
  const v = document.getElementById('pauseDelay').value;
  document.getElementById('pauseDelayLabel').textContent = `Reads back after ${(v / 1000).toFixed(1)}s of silence`;
}

// ============ UI wiring ============
function wireUpUI() {
  // Typing -> pause detection
  editor.addEventListener('input', onType);

  // Word count live
  editor.addEventListener('input', updateWordCount);

  // Settings drawer
  document.getElementById('btnSettings').onclick = () => toggle('settingsOverlay', true);
  document.getElementById('closeSettings').onclick = () => toggle('settingsOverlay', false);
  document.getElementById('settingsOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'settingsOverlay') toggle('settingsOverlay', false);
  });

  document.getElementById('optOpenrouter').onclick = () => setBackendUI('openrouter');
  document.getElementById('optOllama').onclick = () => setBackendUI('ollama');
  document.getElementById('pauseDelay').oninput = updatePauseLabel;

  document.getElementById('saveSettings').onclick = saveSettings;

  // Ask the Editor modal
  document.getElementById('btnAsk').onclick = () => toggle('askOverlay', true);
  document.getElementById('closeAsk').onclick = () => toggle('askOverlay', false);
  document.getElementById('askOverlay').addEventListener('click', (e) => {
    if (e.target.id === 'askOverlay') toggle('askOverlay', false);
  });
  document.getElementById('submitAsk').onclick = submitAsk;

  // Save / Open manuscript
  document.getElementById('btnSave').onclick = saveManuscript;
  document.getElementById('btnOpen').onclick = openManuscript;
}

function toggle(id, show) {
  document.getElementById(id).classList.toggle('visible', show);
}

function updateWordCount() {
  const words = editor.value.trim().split(/\s+/).filter(Boolean).length;
  wordCountEl.textContent = `${words} word${words === 1 ? '' : 's'}`;
}

// ============ Settings persistence ============
async function saveSettings() {
  const backend = document.getElementById('optOllama').classList.contains('active') ? 'ollama' : 'openrouter';
  config = {
    ...config,
    backend,
    openrouterKey: document.getElementById('openrouterKey').value.trim(),
    openrouterModel: document.getElementById('openrouterModel').value.trim() || 'openai/gpt-4o-mini',
    ollamaUrl: document.getElementById('ollamaUrl').value.trim() || 'http://localhost:11434',
    ollamaModel: document.getElementById('ollamaModel').value.trim() || 'llama3.1',
    pauseDelayMs: parseInt(document.getElementById('pauseDelay').value, 10),
    customPrompts: document.getElementById('customPrompts').value
      .split('\n')
      .map((s) => s.trim())
      .filter(Boolean)
  };
  await window.scribewell.setConfig(config);
  toggle('settingsOverlay', false);
  pushFeed('note', 'Settings updated. The editor is ready to read again.');
}

// ============ Pause detection -> AI analysis ============
function onType() {
  clearTimeout(pauseTimer);
  const delay = config.pauseDelayMs || 2500;
  pauseTimer = setTimeout(() => {
    const text = editor.value;
    // Only analyze if there's meaningfully new text since last pass.
    if (text.trim().length === 0) return;
    if (text.length === lastAnalyzedLength) return;
    runAnalysis(text);
  }, delay);
}

async function runAnalysis(fullText) {
  lastAnalyzedLength = fullText.length;
  setStatus('thinking');

  // Only send the AI the tail end of new writing plus the running memory,
  // so it stays fast and doesn't re-read the whole manuscript every pause.
  const recentSlice = fullText.slice(-2400);

  const system = buildSystemPrompt();
  const user = buildAnalysisPrompt(recentSlice);

  const result = await window.scribewell.complete({ systemPrompt: system, userPrompt: user });

  if (result.error) {
    setStatus('error');
    pushToast('note', `Couldn't reach the editor: ${result.error}`);
    return;
  }

  setStatus('idle');
  handleAnalysisResponse(result.text);
}

function buildSystemPrompt() {
  const custom = (config.customPrompts || []).join(' ');
  return [
    "You are a sharp, attentive literary editor reading a manuscript over the writer's shoulder, live, as they write.",
    'You maintain a short running memory of the story (characters, setups, planted details, facts established) and use it to catch things the writer might forget.',
    'Respond ONLY with strict JSON, no markdown fences, no preamble, matching this shape exactly:',
    '{"notes": [{"kind": "foreshadowing|grammar|continuity|character|note", "text": "short note, one or two sentences, written like a perceptive reader\'s marginal comment"}], "memoryUpdate": "an updated 2-4 sentence running summary of the story so far, or empty string if nothing notable changed"}',
    'Only include a note if it is genuinely useful - do not invent filler. If there is nothing worth flagging, return an empty notes array.',
    'Keep each note short, specific, and quote-light. Never use exact quotes over a few words.',
    custom ? `The writer has also asked you to always pay attention to: ${custom}` : ''
  ]
    .filter(Boolean)
    .join(' ');
}

function buildAnalysisPrompt(recentSlice) {
  return [
    storyMemory ? `Running memory of the story so far: ${storyMemory}` : 'No running memory yet - this may be early in the manuscript.',
    'Here is the most recent text the writer has produced (it may start mid-sentence since this is a tail slice of a longer document):',
    '---',
    recentSlice,
    '---',
    'Analyze this latest writing. Return the JSON now.'
  ].join('\n\n');
}

function handleAnalysisResponse(rawText) {
  let parsed;
  try {
    const cleaned = rawText.replace(/```json|```/g, '').trim();
    parsed = JSON.parse(cleaned);
  } catch {
    // If the model didn't return clean JSON, surface it quietly as a note rather than crashing.
    if (rawText && rawText.trim()) {
      pushToast('note', 'The editor had a thought but phrased it oddly - check the margin.');
      pushFeed('note', rawText.trim().slice(0, 280));
    }
    return;
  }

  if (parsed.memoryUpdate && parsed.memoryUpdate.trim()) {
    storyMemory = parsed.memoryUpdate.trim();
  }

  (parsed.notes || []).forEach((note) => {
    if (!note.text) return;
    const kind = ICONS[note.kind] ? note.kind : 'note';
    pushFeed(kind, note.text);
    pushToast(kind, note.text);
  });
}

// ============ Feed (margin) ============
function pushFeed(kind, text) {
  feedItems.unshift({ kind, text, time: new Date() });
  renderFeed();
}

function renderFeed() {
  const emptyMsg = feedList.querySelector('.feed-empty');
  if (emptyMsg) emptyMsg.remove();

  feedList.innerHTML = feedItems
    .map(
      (item) => `
    <div class="feed-card kind-${item.kind}">
      <div class="feed-card-head">
        <span class="feed-icon">${ICONS[item.kind] || '🖋'}</span>
        <span class="feed-kind">${LABELS[item.kind] || 'Note'}</span>
        <span class="feed-time">${formatTime(item.time)}</span>
      </div>
      <div class="feed-text">${escapeHtml(item.text)}</div>
    </div>
  `
    )
    .join('');
}

function formatTime(d) {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function escapeHtml(s) {
  const div = document.createElement('div');
  div.textContent = s;
  return div.innerHTML;
}

// ============ Toasts ============
function pushToast(kind, text) {
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `
    <div class="toast-head"><span>${ICONS[kind] || '🖋'}</span><span>${LABELS[kind] || 'Note'}</span></div>
    <div class="toast-text">${escapeHtml(text)}</div>
  `;
  toastStack.appendChild(el);
  setTimeout(() => el.remove(), 6600);
}

// ============ Status dot ============
function setStatus(state) {
  statusDot.className = 'status-dot' + (state === 'thinking' ? ' thinking' : state === 'error' ? ' error' : '');
  statusDot.title = state === 'thinking' ? 'Reading...' : state === 'error' ? 'Connection issue' : 'Idle';
}

// ============ Ask the Editor (on-demand custom prompt) ============
async function submitAsk() {
  const question = document.getElementById('askInput').value.trim();
  if (!question) return;
  const responseEl = document.getElementById('askResponse');
  responseEl.textContent = 'The editor is considering...';
  setStatus('thinking');

  const system = [
    "You are a sharp, attentive literary editor who has been reading this manuscript over the writer's shoulder.",
    storyMemory ? `Running memory of the story so far: ${storyMemory}` : '',
    'Answer the writer\'s question directly and specifically, like a trusted editor giving honest craft feedback. Plain prose, no JSON this time.'
  ]
    .filter(Boolean)
    .join(' ');

  const user = [
    `Full manuscript so far (most recent portion):\n${editor.value.slice(-6000)}`,
    `\nThe writer asks: ${question}`
  ].join('\n');

  const result = await window.scribewell.complete({ systemPrompt: system, userPrompt: user });
  setStatus('idle');

  if (result.error) {
    responseEl.textContent = `Couldn't reach the editor: ${result.error}`;
    return;
  }
  responseEl.textContent = result.text;
}

// ============ Save / Open ============
async function saveManuscript() {
  const title = document.getElementById('docTitle').textContent.trim() || 'manuscript';
  const path = await window.scribewell.saveDoc({ content: editor.value, suggestedName: `${title}.txt` });
  if (path) pushFeed('note', `Saved to ${path}.`);
}

async function openManuscript() {
  const result = await window.scribewell.openDoc();
  if (!result) return;
  editor.value = result.content;
  lastAnalyzedLength = 0;
  storyMemory = '';
  feedItems = [];
  renderFeed();
  updateWordCount();
}
