import streamlit as st
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings
from langchain.chains import RetrievalQA
from langchain_community.llms import Ollama

import psutil
import time

st.set_page_config(page_title="FREE LLM-Powered PDF Assistant", page_icon="📄")
st.title("📄 FREE LLM-Powered PDF Assistant")

query = st.text_input("Ask a question from your PDF:")

if query:
    # Load embeddings and vector store
    embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
    db = FAISS.load_local("vectorstore", embeddings, allow_dangerous_deserialization=True)

    # Run Ollama locally with Mistral
    llm = Ollama(model="mistral")

    # Time the inference
    start_time = time.time()
    qa = RetrievalQA.from_chain_type(llm=llm, retriever=db.as_retriever())
    result = qa.run(query)
    end_time = time.time()
    latency = round(end_time - start_time, 2)

    # Show LLM response
    st.success(result)

    # 🧠 Find the Ollama LLM process
    def get_ollama_process():
        for proc in psutil.process_iter(attrs=["pid", "name"]):
            try:
                if "ollama" in proc.info["name"].lower() or "mistral" in proc.info["name"].lower():
                    return proc
            except (psutil.NoSuchProcess, psutil.AccessDenied):
                pass
        return None

    ollama_proc = get_ollama_process()

    if ollama_proc:
        try:
            llm_cpu = ollama_proc.cpu_percent(interval=1)
            mem_info = ollama_proc.memory_info()
            llm_mem_mb = round(mem_info.rss / (1024 ** 2), 2)  # in MB
        except psutil.Error:
            llm_cpu = llm_mem_mb = "Unavailable"
    else:
        llm_cpu = llm_mem_mb = "Unavailable"

    # Display Metrics
    st.markdown("---")
    st.subheader("🧠 LLM Metrics")

    col1, col2 = st.columns(2)
    with col1:
        st.metric(label="⏱️ Inference Time", value=f"{latency} sec")
        st.metric(label="🧠 LLM CPU Usage", value=f"{llm_cpu}%" if llm_cpu != "Unavailable" else "Unavailable")
    with col2:
        st.metric(label="💾 LLM RAM (RSS)", value=f"{llm_mem_mb} MB" if llm_mem_mb != "Unavailable" else "Unavailable")
