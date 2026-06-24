// --- Elements ---
const editor = document.getElementById('editor');
const aiFeed = document.getElementById('ai-feed');
const apiKeyInput = document.getElementById('api-key');
const saveKeyBtn = document.getElementById('save-key');
const statusText = document.getElementById('status');
const customPromptInput = document.getElementById('custom-prompt');
const sendPromptBtn = document.getElementById('send-prompt');

let openRouterKey = localStorage.getItem('openRouterKey') || '';
let typingTimer;
const PAUSE_TIME = 3000; // 3 seconds of no typing triggers the AI

// --- Setup API Key ---
if (openRouterKey) {
    apiKeyInput.value = openRouterKey;
    statusText.innerText = "Key loaded!";
}

saveKeyBtn.addEventListener('click', () => {
    openRouterKey = apiKeyInput.value;
    localStorage.setItem('openRouterKey', openRouterKey); // Saves securely in your browser
    statusText.innerText = "Key saved!";
});

// --- The Trigger Logic (Debouncing) ---
editor.addEventListener('keyup', () => {
    clearTimeout(typingTimer);
    if (editor.value.length > 50) { // Only trigger if there's enough text to analyze
        typingTimer = setTimeout(analyzeWriting, PAUSE_TIME);
    }
});

// --- AI Communication ---
async function callOpenRouter(systemInstruction, userText) {
    if (!openRouterKey) {
        addMessageToFeed("Please enter and save your OpenRouter API key first.");
        return;
    }

    addMessageToFeed("Thinking...", true); // Show loading state

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${openRouterKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "openai/gpt-4o-mini", // Fast model for real-time
                "messages": [
                    { "role": "system", "content": systemInstruction },
                    { "role": "user", "content": userText }
                ]
            })
        });

        const data = await response.json();
        
        // Remove the "Thinking..." message
        aiFeed.removeChild(aiFeed.lastChild); 
        
        // Add actual response
        addMessageToFeed(data.choices[0].message.content);
        
    } catch (error) {
        aiFeed.removeChild(aiFeed.lastChild);
        addMessageToFeed("Error connecting to AI: " + error.message);
    }
}

// --- Specific Tasks ---
function analyzeWriting() {
    const text = editor.value;
    const systemPrompt = "You are a writing assistant. The user just paused typing. Analyze the following text briefly. Point out any newly established foreshadowing, check for glaring grammar issues, and track the pacing. Keep your response short, like a helpful margin note in a book.";
    
    callOpenRouter(systemPrompt, text);
}

sendPromptBtn.addEventListener('click', () => {
    const question = customPromptInput.value;
    const text = editor.value;
    if (!question) return;
    
    const systemPrompt = "You are an expert writing assistant helping the user with their current manuscript.";
    const fullPrompt = `Here is my current text:

${text}

My question: ${question}`;
    
    customPromptInput.value = ''; // clear input
    callOpenRouter(systemPrompt, fullPrompt);
});

// --- UI Helpers ---
function addMessageToFeed(text, isTemporary = false) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'ai-message';
    msgDiv.innerText = text;
    aiFeed.appendChild(msgDiv);
    
    // Auto-scroll to the bottom of the feed
    aiFeed.scrollTop = aiFeed.scrollHeight;
}