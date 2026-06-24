// --- Elements ---
const apiKeyInput = document.getElementById('api-key');
const saveKeyBtn = document.getElementById('save-key');
const customPromptInput = document.getElementById('custom-prompt');
const sendPromptBtn = document.getElementById('send-prompt');
const quill = new Quill('#editor', { theme: 'snow' });

// --- Sims-Style Notification System ---
function showSimsPopup(text) {
    const container = document.getElementById('notification-container');
    const popup = document.createElement('div');
    popup.className = 'sims-popup';
    popup.innerHTML = `<span class="close-btn">x</span><div class="popup-content">${text}</div>`;
    popup.querySelector('.close-btn').addEventListener('click', () => popup.remove());
    container.appendChild(popup);
}

// --- AI Communication (Modified to use popups) ---
async function callOpenRouter(systemInstruction, userText) {
    if (!localStorage.getItem('openRouterKey')) {
        showSimsPopup("⚠️ Please enter and save your API key.");
        return;
    }

    try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${localStorage.getItem('openRouterKey')}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                "model": "openai/gpt-4o-mini",
                "messages": [
                    { "role": "system", "content": systemInstruction },
                    { "role": "user", "content": userText }
                ]
            })
        });

        const data = await response.json();
        let responseText = data.choices[0].message.content;

        // Auto-save logic (Lore tags)
        const charRegex = /\[CHARACTERS\]([\s\S]*?)\[\/CHARACTERS\]/i;
        const worldRegex = /\[WORLD\]([\s\S]*?)\[\/WORLD\]/i;

        if (charMatch = responseText.match(charRegex)) {
            document.getElementById('lore-characters').value += "\n" + charMatch[1];
            responseText = responseText.replace(charRegex, '');
        }
        if (worldMatch = responseText.match(worldRegex)) {
            document.getElementById('lore-world').value += "\n" + worldMatch[1];
            responseText = responseText.replace(worldRegex, '');
        }

        // Show the result as a Sims-style popup!
        showSimsPopup(responseText.trim());

    } catch (error) {
        showSimsPopup("Error connecting to AI.");
    }
}

// Logic for analyzeWriting and button clicks remains similar but calls showSimsPopup
function analyzeWriting(text) {
    callOpenRouter("You are a helpful writing coach. Give short advice.", text);
}

sendPromptBtn.addEventListener('click', () => {
    callOpenRouter("You are an assistant.", customPromptInput.value);
    customPromptInput.value = '';
});

customPromptInput.addEventListener('keypress', (e) => { if(e.key === 'Enter') sendPromptBtn.click(); });
