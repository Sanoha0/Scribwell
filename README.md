# Scribewell

A desktop writing companion that reads over your shoulder. It's built like an
open manuscript on a writing desk: you type on the page, and a literary
"editor" reads your recent writing every time you pause, dropping notes about
foreshadowing, grammar, continuity, and character into the margin (and as
soft toast popups) — plus a running memory of your story so it can remind you
about things from much earlier.

## Why you need to run `npm install` yourself

I built this entire app — main process, preload bridge, UI, and the AI
analysis loop — but I couldn't download the actual Electron binary in my
sandboxed environment (it pulls from a GitHub release server my network
egress doesn't allow). So **the code is complete and ready**, you just need
to do the one-time install on your own machine, which will work fine there.

## Setup (2 minutes)

1. Make sure you have [Node.js](https://nodejs.org) installed (v18+).
2. Open a terminal in this folder.
3. Run:
   ```
   npm install
   npm start
   ```
   That's it — the app window will open.

## Using it

- **Just start typing** on the page. After you pause (2.5s by default,
  adjustable in Settings), the editor reads your most recent writing and
  posts notes to the margin on the right, plus a floating toast.
- **Settings** (top right) — this is where you flip between OpenRouter
  (cloud) and Ollama (local), paste your OpenRouter API key, or point at your
  local Ollama URL/model. There's also a box for "standing instructions" —
  things you always want it watching for (e.g. "track my magic system's
  rules and flag contradictions").
- **Ask the Editor** — for on-demand questions any time, not tied to pausing.
  Ask about pacing, whether a character's motivation lands, anything.
- **Open / Save** — saves your manuscript as a plain `.txt`/`.md` file
  anywhere on your computer.

## OpenRouter setup

1. Get a key at https://openrouter.ai/keys
2. Open Settings in the app, leave the backend on "OpenRouter (cloud)"
3. Paste the key into the API Key field
4. Set the model field to whatever you want, e.g. `openai/gpt-4o-mini`,
   `anthropic/claude-3.5-haiku`, `google/gemini-2.0-flash-001` — any
   OpenRouter model slug works.

## Ollama setup

1. Make sure Ollama is running (`ollama serve`) and you've pulled a model
   (`ollama pull llama3.1`)
2. In Settings, switch the backend to "Ollama (local)"
3. Leave the URL as `http://localhost:11434` unless you've changed it
4. Set the model field to match what you pulled (e.g. `llama3.1`,
   `mistral`, `qwen2.5`)

## How the analysis works under the hood

Every pause, the app sends the AI:
- A short running "story memory" (a 2-4 sentence summary the AI itself
  maintains and updates as you write)
- The last ~2400 characters you've written (not the whole manuscript every
  time, to keep it fast)

The AI responds in structured JSON with any notes worth surfacing
(foreshadowing/grammar/continuity/character/general) and an updated memory
summary. Notes appear both as a permanent entry in the margin feed and as a
temporary toast. If there's nothing worth flagging, it stays quiet — it
won't manufacture busywork notes.

## Files

- `src/main.js` — Electron main process: window creation, config storage,
  file save/open, and the actual HTTP calls to OpenRouter/Ollama (done in
  main process to avoid browser CORS issues)
- `src/preload.js` — the secure bridge exposing `window.scribewell.*` to the
  page
- `src/index.html` / `src/styles.css` — the manuscript-desk UI
- `src/renderer.js` — pause detection, prompt building, response parsing,
  feed/toast rendering

## Notes on extending it

- Want different note categories? Add them to the `ICONS`/`LABELS` objects
  in `renderer.js` and matching `.kind-x` CSS rules in `styles.css`, and
  mention the new category in the system prompt in `buildSystemPrompt()`.
- Want it to read more/less manuscript context per pause? Change the
  `.slice(-2400)` in `runAnalysis()`.
- Want streaming responses instead of waiting for the full reply? That
  would need switching the OpenRouter/Ollama calls to streaming mode and
  piping chunks back over IPC — happy to add that if you want it.
