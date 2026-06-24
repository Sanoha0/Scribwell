# Full-Stack Smart Writing Book

This is the advanced, full-stack version of the Smart Writing Book. It includes a Python backend (`main.py`) that handles a local SQLite database and safe API routing to both OpenRouter and local Ollama models, alongside a rich-text UI.

## How to Run This Locally:
1. Make sure you have Python installed.
2. Open your terminal/command prompt inside this folder.
3. Install the required Python libraries by running:
   `pip install -r requirements.txt`
4. Start the backend server by running:
   `python main.py`
5. Leave the terminal running. Now, double-click the `index.html` file to open it in your web browser. 

You can toggle between OpenRouter (requires your API key in the top bar) or local Ollama from the dropdown!

---

## ⚠️ Crucial Warning About GitHub Pages ⚠️
You mentioned wanting to host this on a GitHub website page. **GitHub Pages only supports static frontend files (HTML, CSS, JS).** GitHub Pages **cannot** run a Python server, nor can it host an SQLite database. 

If you upload this entire folder to GitHub Pages, the interface will load, but the AI and the "Save to Database" features will break because the Python backend (`main.py`) won't be running.

### How to host this Full-Stack app online:
If you want to use this app from your phone or anywhere else, you need a hosting provider that supports Python backends. Free or cheap options include:
1. **Render.com** (Highly recommended, has a free tier for web services)
2. **Railway.app**
3. **PythonAnywhere**

If you strictly want to use **GitHub Pages**, you will need to revert to the previous "Frontend-Only" version where the browser talked to OpenRouter directly, without the Python database features.
