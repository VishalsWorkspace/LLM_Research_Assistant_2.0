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
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_groq import ChatGroq
from langchain_classic.chains import create_retrieval_chain
from langchain_classic.chains.combine_documents import create_stuff_documents_chain
from langchain_core.prompts import ChatPromptTemplate

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}}) 

embeddings = None
db = None
llm = None

def load_resources():
    global embeddings, llm
    
    # 1. Initialize Google Gemini Embeddings with correct model
    if embeddings is None:
        try:
            google_api_key = os.getenv("GOOGLE_API_KEY")
            if not google_api_key:
                raise ValueError("GOOGLE_API_KEY not found in environment.")
            
            # REMOVE the 'models/' prefix - just use the string directly
            embeddings = GoogleGenerativeAIEmbeddings(
                model="text-embedding-004", 
                google_api_key=google_api_key
            )
            print("✅ Google Gemini Embeddings loaded.")
        except Exception as e:
            print(f"❌ Embeddings error: {e}")

    # 2. Initialize Groq LLM
    if llm is None:
        try:
            api_key = os.getenv("GROQ_API_KEY")
            if not api_key:
                raise ValueError("GROQ_API_KEY not found in .env")
            
            llm = ChatGroq(
                temperature=0, 
                groq_api_key=api_key, 
                model_name="llama-3.1-8b-instant"
            )
            print("✅ Groq LLM initialized.")
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

            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
                file.save(temp_file.name)
                
                loader = PyPDFLoader(temp_file.name)
                documents = loader.load()
                
                splitter = RecursiveCharacterTextSplitter(chunk_size=1000, chunk_overlap=100)
                chunks = splitter.split_documents(documents)

                # BATCHING LOGIC: Process in small groups to avoid 429 Rate Limit
                batch_size = 5 
                db = None
                
                for i in range(0, len(chunks), batch_size):
                    batch = chunks[i : i + batch_size]
                    if db is None:
                        db = FAISS.from_documents(batch, embeddings)
                    else:
                        db.add_documents(batch)
                    
                    # Polite delay between batches
                    time.sleep(2) 
                    print(f"Processed batch {i // batch_size + 1}/{(len(chunks) // batch_size) + 1}")

            os.remove(temp_file.name) 
            return jsonify({'message': f'PDF "{file.filename}" ingested successfully!'}), 200
        except Exception as e:
            print(f"Final Error: {e}")
            return jsonify({'message': 'Embedding limit reached. Please try again or use a smaller file.'}), 500
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
                'model': 'Llama-3.1-8b'
            }
        }), 200

    except Exception as e:
        return jsonify({'message': f'Inference Error: {str(e)}'}), 500

if __name__ == '__main__':
    load_resources()
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=False)