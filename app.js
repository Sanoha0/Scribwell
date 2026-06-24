const apiKeyInput = document.getElementById('api-key');
const backendSelect = document.getElementById('backend-select');
const saveBtn = document.getElementById('save-btn');
const statusText = document.getElementById('status');
const aiFeed = document.getElementById('ai-feed');

// Load saved API key from the browser memory
let openRouterKey = localStorage.getItem('openRouterKey') || '';
if (openRouterKey) {
    apiKeyInput.value = openRouterKey;
}

// Auto-save the API key when you type it
apiKeyInput.addEventListener('change', () => {
    localStorage.setItem('openRouterKey', apiKeyInput.value);
});

// Initialize the Quill Rich Text Editor
var quill = new Quill('#editor', {
    theme: 'snow',
    placeholder: 'The Rise of Cadance begins here... What awaits Sanoha Knight? Start typing to find out.'
});

// Trigger Logic setup
let typingTimer;
const PAUSE_TIME = 3000; // 3 seconds

// Listen to the Quill editor
quill.on('text-change', function() {
    clearTimeout(typingTimer);
    let text = quill.getText(); // Get plain text for the AI
    if (text.length > 50) {
        typingTimer = setTimeout(() => analyzeWriting(text), PAUSE_TIME);
    }
});

// Talk to the Python Backend
async function analyzeWriting(text) {
    addMessageToFeed("Thinking...", true);
    
    try {
        const response = await fetch("http://localhost:8000/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                text: text,
                ai_backend: backendSelect.value,
                api_key: apiKeyInput.value
            })
        });
        
        const data = await response.json();
        aiFeed.removeChild(aiFeed.lastChild); // Remove "Thinking..."
        addMessageToFeed(data.response);
    } catch (error) {
        aiFeed.removeChild(aiFeed.lastChild);
        addMessageToFeed("Error: Could not reach the Python backend. Make sure you ran 'python main.py' in your terminal.");
    }
}

// Save to SQLite Database via Python
saveBtn.addEventListener('click', async () => {
    statusText.innerText = "Saving...";
    try {
        await fetch("http://localhost:8000/api/save", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                title: "My Chapter",
                content: quill.root.innerHTML // Save the HTML format so bold/italics are preserved
            })
        });
        statusText.innerText = "Saved to DB!";
        setTimeout(() => statusText.innerText = "", 3000);
    } catch (e) {
        statusText.innerText = "Save failed. Backend not running.";
    }
});

// UI Helper
function addMessageToFeed(text) {
    const msgDiv = document.createElement('div');
    msgDiv.className = 'ai-message';
    msgDiv.innerText = text;
    aiFeed.appendChild(msgDiv);
    aiFeed.scrollTop = aiFeed.scrollHeight; // Auto-scroll to bottom
}