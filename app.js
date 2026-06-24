// --- Elements ---
const apiKeyInput = document.getElementById('api-key');
const saveKeyBtn = document.getElementById('save-key');
const statusText = document.getElementById('status');
const aiFeed = document.getElementById('ai-feed');
const customPromptInput = document.getElementById('custom-prompt');
const sendPromptBtn = document.getElementById('send-prompt');
const wordCountDisplay = document.getElementById('word-count-display');

// Left Sidebar Elements
const tabChaptersBtn = document.getElementById('tab-chapters-btn');
const tabLoreBtn = document.getElementById('tab-lore-btn');
const tabChapters = document.getElementById('tab-chapters');
const tabLore = document.getElementById('tab-lore');
const chapterListEl = document.getElementById('chapter-list');
const newChapterBtn = document.getElementById('new-chapter-btn');
const chapterTitleInput = document.getElementById('chapter-title-input');

// Lore Elements
const loreCharacters = document.getElementById('lore-characters');
const loreWorld = document.getElementById('lore-world');

// --- State Management ---
let openRouterKey = localStorage.getItem('openRouterKey') || '';
let chapters = JSON.parse(localStorage.getItem('chapters')) || [];
let currentChapterId = localStorage.getItem('currentChapterId') || null;
let loreData = JSON.parse(localStorage.getItem('loreData')) || { characters: '', world: '' };

let typingTimer;
const PAUSE_TIME = 3000;

// --- Initialization ---
if (openRouterKey) {
    apiKeyInput.value = openRouterKey;
    statusText.innerText = "Key loaded!";
    statusText.style.color = "#2ecc71";
}

loreCharacters.value = loreData.characters;
loreWorld.value = loreData.world;

var quill = new Quill('#editor', {
    theme: 'snow',
    placeholder: 'Start writing your masterpiece...'
});

// Create first chapter if none exist
if (chapters.length === 0) {
    createNewChapter();
} else {
    if (!currentChapterId || !chapters.find(c => c.id == currentChapterId)) {
        currentChapterId = chapters[0].id;
    }
    renderChapterList();
    loadChapter(currentChapterId);
}

// --- Event Listeners: UI & API Keys ---
saveKeyBtn.addEventListener('click', () => {
    openRouterKey = apiKeyInput.value.trim();
    localStorage.setItem('openRouterKey', openRouterKey);
    statusText.innerText = "Key saved!";
    statusText.style.color = "#2ecc71";
});

// Tabs logic
tabChaptersBtn.addEventListener('click', () => {
    tabChaptersBtn.classList.add('active');
    tabLoreBtn.classList.remove('active');
    tabChapters.classList.add('active');
    tabLore.classList.remove('active');
});

tabLoreBtn.addEventListener('click', () => {
    tabLoreBtn.classList.add('active');
    tabChaptersBtn.classList.remove('active');
    tabLore.classList.add('active');
    tabChapters.classList.remove('active');
});

// --- Event Listeners: Saving Data ---
function saveData() {
    localStorage.setItem('chapters', JSON.stringify(chapters));
    localStorage.setItem('loreData', JSON.stringify(loreData));
    localStorage.setItem('currentChapterId', currentChapterId);
}

loreCharacters.addEventListener('input', () => {
    loreData.characters = loreCharacters.value;
    saveData();
});

loreWorld.addEventListener('input', () => {
    loreData.world = loreWorld.value;
    saveData();
});

chapterTitleInput.addEventListener('input', () => {
    const chapter = chapters.find(c => c.id == currentChapterId);
    if (chapter) {
        chapter.title = chapterTitleInput.value;
        saveData();
        renderChapterList();
    }
});

quill.on('text-change', function() {
    const text = quill.getText().trim();
    const words = text.length > 0 ? text.split(/\s+/).length : 0;
    wordCountDisplay.innerText = words;

    const chapter = chapters.find(c => c.id == currentChapterId);
    if (chapter) {
        chapter.content = quill.root.innerHTML;
        saveData();
    }

    clearTimeout(typingTimer);
    if (text.length > 50) {
        typingTimer = setTimeout(() => analyzeWriting(text), PAUSE_TIME);
    }
});

// --- Chapter Management ---
function createNewChapter() {
    const newId = Date.now().toString();
    const newChap = { id: newId, title: "Untitled Chapter", content: "" };
    chapters.push(newChap);
    saveData();
    renderChapterList();
    loadChapter(newId);
}

newChapterBtn.addEventListener('click', createNewChapter);

function loadChapter(id) {
    currentChapterId = id;
    const chapter = chapters.find(c => c.id == id);
    if (chapter) {
        chapterTitleInput.value = chapter.title;
        quill.root.innerHTML = chapter.content;
        saveData();
        renderChapterList();
        
        const text = quill.getText().trim();
        wordCountDisplay.innerText = text.length > 0 ? text.split(/\s+/).length : 0;
    }
}

function renderChapterList() {
    chapterListEl.innerHTML = '';
    chapters.forEach(ch => {
        const li = document.createElement('li');
        li.innerText = ch.title || "Untitled";
        if (ch.id == currentChapterId) li.classList.add('active');
        li.addEventListener('click', () => loadChapter(ch.id));
        
        const delBtn = document.createElement('span');
        delBtn.innerText = " 🗑️";
        delBtn.style.float = "right";
        delBtn.style.fontSize = "0.8rem";
        delBtn.onclick = (e) => {
            e.stopPropagation();
            if(confirm(`Delete ${ch.title}?`)) {
                chapters = chapters.filter(c => c.id != ch.id);
                if(chapters.length === 0) createNewChapter();
                else if(currentChapterId == ch.id) loadChapter(chapters[0].id);
                else { saveData(); renderChapterList(); }
            }
        };
        li.appendChild(delBtn);
        chapterListEl.appendChild(li);
    });
}

// --- AI Communication ---
async function callOpenRouter(systemInstruction, userText) {
    if (!openRouterKey) {
        addMessageToFeed("⚠️ Please enter and save your OpenRouter API key first.");
        return;
    }

    addMessageToFeed("Thinking...", true);

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openRouterKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "openai/gpt-4o-mini", // The default model
                "messages": [
                    { "role": "system", "content": systemInstruction },
                    { "role": "user", "content": userText }
                ]
            })
        });

        const data = await response.json();
        aiFeed.removeChild(aiFeed.lastChild); // Remove loading state
        
        if (data.choices && data.choices[0]) {
            let responseText = data.choices[0].message.content;

            // --- AUTO-FILL MAGIC ---
            // Look for [CHARACTERS] tags and extract them
            const charRegex = /\[CHARACTERS\]([\s\S]*?)\[\/CHARACTERS\]/i;
            const charMatch = responseText.match(charRegex);
            if (charMatch) {
                // Append new info to the existing box
                const newLore = charMatch[1].trim();
                loreCharacters.value = (loreCharacters.value + "\n\n" + newLore).trim();
                loreData.characters = loreCharacters.value;
                saveData();
                responseText = responseText.replace(charRegex, '').trim(); // Remove tags from chat
                addMessageToFeed("✅ Added new character lore to your Story Bible!");
            }

            // Look for [WORLD] tags and extract them
            const worldRegex = /\[WORLD\]([\s\S]*?)\[\/WORLD\]/i;
            const worldMatch = responseText.match(worldRegex);
            if (worldMatch) {
                const newWorld = worldMatch[1].trim();
                loreWorld.value = (loreWorld.value + "\n\n" + newWorld).trim();
                loreData.world = loreWorld.value;
                saveData();
                responseText = responseText.replace(worldRegex, '').trim();
                addMessageToFeed("✅ Updated Worldbuilding rules in your Story Bible!");
            }

            // If there's any normal chat text left, display it
            if (responseText.trim().length > 0) {
                addMessageToFeed(responseText);
            }

        } else {
            addMessageToFeed("Error: Unexpected response format from OpenRouter.");
        }
    } catch (error) {
        aiFeed.removeChild(aiFeed.lastChild);
        addMessageToFeed("Error connecting to AI: " + error.message);
    }
}

function getContextPrompt() {
    let context = "You are an expert creative writing mentor. Keep your notes conversational, concise, and helpful.\n\n";
    if (loreData.characters.trim() || loreData.world.trim()) {
        context += "=== STORY BIBLE CONTEXT ===\n";
        if (loreData.characters.trim()) context += `CHARACTERS:\n${loreData.characters}\n\n`;
        if (loreData.world.trim()) context += `WORLDBUILDING LORE:\n${loreData.world}\n\n`;
        context += "=========================\n";
        context += "Keep this lore in mind.\n";
    }
    return context;
}

function analyzeWriting(text) {
    let systemPrompt = getContextPrompt();
    systemPrompt += "The writer just paused typing. Briefly analyze the recent text for foreshadowing, pacing, character consistency, or obvious grammar slips.";
    callOpenRouter(systemPrompt, "Here is my latest text:\n" + text);
}

// --- ENTER KEY TO SEND ---
customPromptInput.addEventListener('keypress', function (e) {
    if (e.key === 'Enter') {
        sendPromptBtn.click();
    }
});

sendPromptBtn.addEventListener('click', () => {
    const question = customPromptInput.value.trim();
    const text = quill.getText().trim();
    if (!question) return;

    let systemPrompt = getContextPrompt();
    systemPrompt += "\nIf the user asks you to write, generate, or update character lore, you MUST wrap the exact lore text inside [CHARACTERS] and [/CHARACTERS] tags so the system can save it.\n";
    systemPrompt += "If they ask you to write or update worldbuilding, you MUST wrap the exact text inside [WORLD] and [/WORLD] tags.\n";
    systemPrompt += "Place any conversational response outside of these tags.";
    
    const fullPrompt = `Here is my current story text:\n\n${text}\n\nMy question: ${question}`;

    customPromptInput.value = '';
    callOpenRouter(systemPrompt, fullPrompt);
});

function addMessageToFeed(text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'ai-message';
    msgDiv.innerText = text;
    aiFeed.appendChild(msgDiv);
    aiFeed.scrollTop = aiFeed.scrollHeight;
}

// --- Export to Word/Google Docs (.doc) ---
document.getElementById('export-word-btn').addEventListener('click', () => {
    let exportHTML = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'>
    <head><meta charset='utf-8'><title>Exported Story</title>
    <style>
        body { font-family: 'Georgia', serif; font-size: 12pt; line-height: 1.6; }
        h1 { page-break-before: always; text-align: center; margin-bottom: 24pt; font-size: 18pt;}
        p { margin-bottom: 12pt; text-indent: 0.5in; }
    </style>
    </head><body>`;

    chapters.forEach(ch => {
        exportHTML += `<h1>${ch.title}</h1>`;
        exportHTML += ch.content;
    });

    exportHTML += `</body></html>`;

    const blob = new Blob(['\ufeff', exportHTML], {
        type: 'application/msword'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'My_Masterpiece.doc';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
});
