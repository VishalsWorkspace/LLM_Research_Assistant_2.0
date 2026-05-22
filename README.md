# Cloud PDF Research Assistant (RAG)

An AI-powered Retrieval-Augmented Generation (RAG) system that allows users to upload PDFs and query documents using natural language.

Originally built as a **local-first privacy-focused prototype**, the project later evolved into a **cloud-deployed architecture** to improve accessibility, usability, and deployment scalability.

---

## Demo

Live App: https://llm-pdf-research-assistant.netlify.app/

Demo Video: https://drive.google.com/file/d/18W0pvAXXbf5ezvt7G1ZkRW28Hwf2EsCo/view?usp=sharing

---

## Evolution of the System

### Phase 1 — Local Proof of Concept

The first version was designed to run completely offline.

**Goals**
- Understand RAG systems end-to-end
- Keep document processing private
- Experiment with local inference

**Architecture**

PDF  
↓  
Ollama (Local LLM)  
↓  
Local Embeddings  
↓  
FAISS Vector Database

---

### Phase 2 — Cloud Deployment

The system was redesigned into a deployable web application.

**Why migrate?**
- Reduce local hardware dependency
- Improve accessibility
- Enable public usage
- Learn deployment architecture

**Architecture**

Frontend (Netlify)  
↓  
Flask Backend (Render)  
↓  
Groq LLM API (Llama 3.3)  
↓  
Google Embeddings  
↓  
FAISS Vector Store

---

## Features

- PDF Upload & semantic retrieval
- Retrieval-Augmented Generation (RAG)
- Natural language document querying
- FAISS vector search
- Cloud-deployed backend
- Responsive modern UI
- Low-latency inference using Groq

---

## Tech Stack

### Frontend
- HTML
- CSS
- JavaScript

### Backend
- Flask
- Python

### AI / Retrieval
- LangChain
- FAISS
- Groq API
- Google Embeddings

### Deployment
- Netlify
- Render

---

## Example Workflow

1. Upload PDF document  
2. Document is chunked and embedded  
3. Embeddings stored in FAISS vector database  
4. User submits a query  
5. Relevant context is retrieved  
6. LLM generates an answer

---

## Running Locally

### Clone Repository

```bash
git clone YOUR_REPO_LINK
cd PROJECT_NAME
