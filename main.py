from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import sqlite3
import requests
import json

app = FastAPI()

# Allow the HTML frontend to talk to this Python backend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Database Setup ---
def init_db():
    conn = sqlite3.connect('writing_book.db')
    c = conn.cursor()
    c.execute('''CREATE TABLE IF NOT EXISTS chapters (id INTEGER PRIMARY KEY, title TEXT, content TEXT)''')
    c.execute('''CREATE TABLE IF NOT EXISTS lore (id INTEGER PRIMARY KEY, character_name TEXT, background TEXT)''')
    conn.commit()
    conn.close()

init_db()

# --- Data Models ---
class SaveRequest(BaseModel):
    title: str
    content: str

class AIRequest(BaseModel):
    text: str
    ai_backend: str
    api_key: str = ""

# --- API Routes ---
@app.post("/api/save")
async def save_chapter(req: SaveRequest):
    conn = sqlite3.connect('writing_book.db')
    c = conn.cursor()
    c.execute("INSERT INTO chapters (title, content) VALUES (?, ?)", (req.title, req.content))
    conn.commit()
    conn.close()
    return {"status": "saved"}

@app.post("/api/analyze")
async def analyze_text(req: AIRequest):
    system_prompt = "You are a writing assistant. Review the user's latest text. Point out foreshadowing, pacing, and grammar. Keep your response short, like a helpful margin note."
    
    if req.ai_backend == 'openrouter':
        if not req.api_key:
            return {"response": "Error: OpenRouter API Key is missing. Please enter it in the header."}
        try:
            response = requests.post(
                url="https://openrouter.ai/api/v1/chat/completions",
                headers={"Authorization": f"Bearer {req.api_key}"},
                json={
                    "model": "openai/gpt-4o-mini",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": req.text}
                    ]
                }
            )
            return {"response": response.json()['choices'][0]['message']['content']}
        except Exception as e:
            return {"response": f"Error connecting to OpenRouter: {str(e)}"}
            
    elif req.ai_backend == 'ollama':
        try:
            response = requests.post(
                url="http://localhost:11434/api/chat",
                json={
                    "model": "llama3", # Feel free to change to your downloaded Ollama model
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": req.text}
                    ],
                    "stream": False
                }
            )
            return {"response": response.json()['message']['content']}
        except Exception as e:
            return {"response": "Error connecting to Ollama. Make sure the Ollama app is running on your computer."}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
