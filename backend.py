import os
import tempfile
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Modern LangChain Imports
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings
from langchain_groq import ChatGroq
from langchain_classic.chains import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate

load_dotenv()

app = Flask(__name__)
# Allow CORS for local dev and your future Netlify/Vercel domain
CORS(app, resources={r"/*": {"origins": "*"}}) 

embeddings = None
db = None
llm = None

def load_resources():
    global embeddings, llm
    if embeddings is None:
        try:
            embeddings = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")
            print("✅ HuggingFace Embeddings loaded.")
        except Exception as e:
            print(f"❌ Embeddings error: {e}")

    if llm is None:
        try:
            # Using Groq for blazing fast, free-tier cloud inference
            api_key = os.getenv("GROQ_API_KEY")
            if not api_key:
                raise ValueError("GROQ_API_KEY not found in .env")
            llm = ChatGroq(temperature=0, groq_api_key=api_key, model_name="llama-3.1-8b-instant")
            print("✅ Groq LLM (Llama 3) initialized.")
        except Exception as e:
            print(f"❌ LLM error: {e}")

@app.route('/upload_pdf', methods=['POST'])
def upload_pdf():
    global db 

    if 'pdf' not in request.files:
        return jsonify({'message': 'No PDF file provided'}), 400

    file = request.files['pdf']
    if file.filename == '':
        return jsonify({'message': 'No selected file'}), 400

    if file and file.filename.endswith('.pdf'):
        try:
            if embeddings is None:
                load_resources()

            # Use NamedTemporaryFile to ensure cloud compatibility (Render/Heroku)
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
                file.save(temp_file.name)
                
                loader = PyPDFLoader(temp_file.name)
                documents = loader.load()
                
                splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
                chunks = splitter.split_documents(documents)

                # Store in-memory for the session (best for free cloud tiers)
                db = FAISS.from_documents(chunks, embeddings)

            os.remove(temp_file.name) # Clean up temp file
            
            return jsonify({'message': f'PDF "{file.filename}" ingested successfully!'}), 200
        except Exception as e:
            return jsonify({'message': f'Error processing PDF: {str(e)}'}), 500
    else:
        return jsonify({'message': 'Only PDF files are allowed.'}), 400


@app.route('/ask_pdf', methods=['POST'])
def ask_pdf():
    data = request.get_json()
    query = data.get('query')

    if not query:
        return jsonify({'message': 'No query provided'}), 400

    if db is None or llm is None:
        load_resources()
        if db is None:
            return jsonify({'message': 'Please upload a PDF first.'}), 400

    try:
        # Modern LCEL Chain Setup
        prompt = ChatPromptTemplate.from_template("""
        Answer the following question based only on the provided context. 
        If the answer is not in the context, say "I cannot answer this based on the provided document."
        
        <context>
        {context}
        </context>

        Question: {input}
        """)

        document_chain = create_stuff_documents_chain(llm, prompt)
        retriever = db.as_retriever(search_kwargs={"k": 3})
        retrieval_chain = create_retrieval_chain(retriever, document_chain)

        start_time = time.time()
        response = retrieval_chain.invoke({"input": query})
        latency = round(time.time() - start_time, 2)

        return jsonify({
            'response': response["answer"],
            'metrics': {
                'latency': latency,
                'provider': 'Groq Cloud',
                'model': 'Llama-3-8b'
            }
        }), 200

    except Exception as e:
        return jsonify({'message': f'Inference Error: {str(e)}'}), 500

if __name__ == '__main__':
    load_resources()
    # Port must be dynamic for cloud deployment
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=False)