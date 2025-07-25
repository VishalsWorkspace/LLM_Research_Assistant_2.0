import os
import time
import psutil
from flask import Flask, request, jsonify
from flask_cors import CORS

# Imports from ingest.py
from langchain_community.document_loaders import PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_community.embeddings import HuggingFaceEmbeddings

# Imports from app.py
from langchain.chains import RetrievalQA
from langchain_community.llms import Ollama

app = Flask(__name__)
# Enable CORS for all origins. In a production environment, you might want to restrict this
# to specific origins for security reasons (e.g., CORS(app, resources={r"/api/*": {"origins": "http://localhost:3000"}})).
CORS(app)

# Define directories for uploaded PDFs and the FAISS vector store
UPLOAD_FOLDER = 'data'
VECTORSTORE_DIR = 'vectorstore'

# Create directories if they don't exist
os.makedirs(UPLOAD_FOLDER, exist_ok=True)
os.makedirs(VECTORSTORE_DIR, exist_ok=True)

# Global variables to store embeddings and FAISS DB
# These will be loaded once when the Flask app starts
embeddings = None
db = None
llm = None # Ollama LLM instance

# Function to load embeddings and vector store
# This helps avoid reloading these heavy resources on every request
def load_resources():
    global embeddings, db, llm
    if embeddings is None:
        try:
            # Load the HuggingFace embeddings model
            embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
            print("✅ HuggingFace Embeddings model loaded.")
        except Exception as e:
            print(f"❌ Error loading HuggingFace Embeddings: {e}")
            embeddings = None

    if db is None and embeddings is not None:
        try:
            # Attempt to load the existing FAISS vector store
            db = FAISS.load_local(VECTORSTORE_DIR, embeddings, allow_dangerous_deserialization=True)
            print("✅ FAISS vectorstore loaded from local.")
        except Exception as e:
            print(f"⚠️ FAISS vectorstore not found or error loading: {e}. Please upload a PDF to create one.")
            db = None # Ensure db is None if loading fails

    if llm is None:
        try:
            # Initialize Ollama LLM with Mistral model
            llm = Ollama(model="mistral")
            print("✅ Ollama (Mistral) LLM initialized.")
        except Exception as e:
            print(f"❌ Error initializing Ollama LLM: {e}. Make sure Ollama is running and 'mistral' model is pulled.")
            llm = None

# Endpoint for uploading and ingesting a PDF file
@app.route('/upload_pdf', methods=['POST'])
def upload_pdf():
    global db # Allow modification of the global db object

    # Check if a file was sent in the request
    if 'pdf' not in request.files:
        return jsonify({'message': 'No PDF file part in the request'}), 400

    file = request.files['pdf']
    # Check if the file name is empty
    if file.filename == '':
        return jsonify({'message': 'No selected file'}), 400

    # Validate file type
    if file and file.filename.endswith('.pdf'):
        filepath = os.path.join(UPLOAD_FOLDER, file.filename)
        try:
            # Save the uploaded PDF file
            file.save(filepath)
            print(f"📄 PDF saved to {filepath}")

            # Load and split the PDF documents
            loader = PyPDFLoader(filepath)
            documents = loader.load()
            splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=50)
            chunks = splitter.split_documents(documents)

            # Ensure embeddings are loaded before creating vector store
            if embeddings is None:
                load_resources() # Attempt to load resources if not already
                if embeddings is None:
                    return jsonify({'message': 'Embeddings model failed to load. Cannot process PDF.'}), 500

            # Create and save the FAISS vector store
            db = FAISS.from_documents(chunks, embeddings)
            db.save_local(VECTORSTORE_DIR)

            print("✅ PDF successfully embedded and vectorstore updated.")
            return jsonify({'message': f'PDF "{file.filename}" ingested successfully!'}), 200
        except Exception as e:
            # General error handling for PDF processing
            print(f"❌ Error processing PDF: {e}")
            return jsonify({'message': f'Error processing PDF: {str(e)}'}), 500
    else:
        return jsonify({'message': 'Invalid file type. Only PDF files are allowed.'}), 400

# Helper function to find the Ollama LLM process for metrics (from app.py)
def get_ollama_process():
    for proc in psutil.process_iter(attrs=["pid", "name"]):
        try:
            # Check for 'ollama' or 'mistral' in process name
            if "ollama" in proc.info["name"].lower() or "mistral" in proc.info["name"].lower():
                return proc
        except (psutil.NoSuchProcess, psutil.AccessDenied):
            pass
    return None

# Endpoint for asking questions to the LLM
@app.route('/ask_pdf', methods=['POST'])
def ask_pdf():
    data = request.get_json()
    query = data.get('query')

    if not query:
        return jsonify({'message': 'No query provided'}), 400

    # Ensure resources are loaded before querying
    if db is None or llm is None:
        load_resources()
        if db is None:
            return jsonify({'message': 'Vector store not loaded. Please upload a PDF first or ensure ingest.py was run.'}), 500
        if llm is None:
            return jsonify({'message': 'LLM not initialized. Please check Ollama setup.'}), 500

    try:
        # Create the RetrievalQA chain
        qa = RetrievalQA.from_chain_type(llm=llm, retriever=db.as_retriever())

        start_time = time.time()
        # Run the query through the LLM
        result = qa.run(query)
        end_time = time.time()
        latency = round(end_time - start_time, 2)

        # Get LLM performance metrics
        ollama_proc = get_ollama_process()
        llm_cpu = "Unavailable"
        llm_mem_mb = "Unavailable"

        if ollama_proc:
            try:
                # Get CPU usage (short interval to not block)
                llm_cpu = ollama_proc.cpu_percent(interval=0.1)
                mem_info = ollama_proc.memory_info()
                llm_mem_mb = round(mem_info.rss / (1024 ** 2), 2)  # Convert bytes to MB
            except psutil.Error:
                pass # Keep as "Unavailable" if psutil error occurs

        # Return the LLM response and metrics
        return jsonify({
            'response': result,
            'metrics': {
                'latency': latency,
                'llm_cpu': llm_cpu,
                'llm_mem_mb': llm_mem_mb
            }
        }), 200

    except Exception as e:
        # General error handling for LLM inference
        print(f"❌ Error during LLM inference: {e}")
        return jsonify({'message': f'Error during LLM inference: {str(e)}'}), 500

# Run the Flask app
if __name__ == '__main__':
    load_resources() # Load resources when the app starts
    app.run(host='0.0.0.0', port=5000, debug=True) # Run on all available interfaces, port 5000
