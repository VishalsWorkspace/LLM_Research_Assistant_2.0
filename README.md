# 🧠 Offline LLM-Powered PDF Assistant

> A 100% offline, ChatGPT-style question-answering app for any PDF using **Ollama (Mistral)**, **FAISS**, **HuggingFace Embeddings**, and **Streamlit** — now with built-in LLM performance metrics.

---

## 🔍 What It Does

- Upload any PDF (`data/sample.pdf`)
- Ask any question about the PDF
- Uses **Mistral 7B** running locally via **Ollama**
- Embeds content with **sentence-transformers**
- Finds relevant context using **FAISS vector search**
- Responds in full paragraphs — just like ChatGPT — but offline
- 📊 Tracks **real-time performance metrics** for the LLM

---

## 📊 What Metrics Are Tracked

Each time a question is asked, the app shows:

| Metric             | Description                                  |
|--------------------|----------------------------------------------|
| ⏱️ Inference Time  | Time taken for the LLM to generate a response |
| 🧠 LLM CPU Usage   | CPU % used by the Ollama process              |
| 💾 LLM RAM Usage   | RAM used by the LLM (RSS memory in MB)        |

---

## 📦 Requirements

- Python 3.9 or above
- `pip install -r requirements.txt`
- [Install Ollama](https://ollama.com/download) and run:
  ```bash
  ollama run mistral

📄 Sample PDF Included
We’ve included the official LLM Technical Report (GPT-4) as a sample PDF:

📘 GPT-4 Technical Report (arXiv)
📁 Located in: data/sample.pdf

🤖 Try Prompts Like:
“What are the key differences between GPT-3.5 and GPT-4?”

“Mention benchmark scores”

“Limitations of GPT-4?”

“Summarize the performance of GPT-4 on academic tasks”

“What tests were used to evaluate GPT-4?”

“Does GPT-4 outperform humans?”

🖥️ Run Locally (Offline, No API Keys)
1. Clone the repository
bash
Copy
Edit
git clone https://github.com/YOUR_USERNAME/llm_research_assistant.git
cd llm_research_assistant
2. Create a virtual environment
bash
Copy
Edit
python -m venv venv
venv\Scripts\activate  # On Windows
3. Install Python dependencies
bash
Copy
Edit
pip install -r requirements.txt
4. Download & run the LLM via Ollama
bash
Copy
Edit
ollama run mistral
First-time download may take a few GB. Once installed, it runs fully offline.

5. Ingest the PDF into FAISS
bash
Copy
Edit
python ingest.py
This converts your PDF into vector chunks for search.

6. Launch the app
bash
Copy
Edit
streamlit run app.py
Visit your assistant at: http://localhost:8501

📁 Folder Structure
pgsql
Copy
Edit
llm_research_assistant/
├── app.py                ← Streamlit UI with real-time LLM metrics
├── ingest.py             ← PDF processing & vectorstore creation
├── requirements.txt
├── README.md
├── .gitignore
├── data/
│   └── sample.pdf        ← GPT-4 Technical Report (sample PDF)
├── vectorstore/          ← FAISS DB (auto-generated)
🔐 Why Offline?
✅ No API keys needed (100% local)

✅ Works without internet once setup is complete

✅ Keeps your documents private and secure

✅ Useful for sensitive research, reports, or legal files

👨‍💻 Author
Built with 💻 by Vishal Chauhan

Star the repo ⭐ if you found it helpful — open to contributors!

yaml
Copy
Edit

---

Let me know if you want:
- A badge header (e.g. `made-with-python`, `offline-ai`, etc.)
- Screenshots or a GIF added to this
- A separate `docs/` folder with usage guide