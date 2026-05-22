import os
import tempfile
import time
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# LangChain Imports (fixed from langchain_classic which doesn't exist)
from langchain_community.document_loaders import PyPDFLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_community.vectorstores import FAISS
from langchain_google_genai import GoogleGenerativeAIEmbeddings
from langchain_groq import ChatGroq
from langchain.chains import create_retrieval_chain                         # FIX: was langchain_classic
from langchain.chains.combine_documents import create_stuff_documents_chain # FIX: was langchain_classic
from langchain_core.prompts import ChatPromptTemplate

load_dotenv()

app = Flask(__name__)
CORS(app, resources={r"/*": {"origins": "*"}})

embeddings = None
db = None
llm = None

MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB — raised from 1MB


def load_resources():
    global embeddings, llm

    if embeddings is None:
        try:
            google_api_key = os.getenv("GOOGLE_API_KEY")
            if not google_api_key:
                raise ValueError("GOOGLE_API_KEY not found in environment.")

            # FIX: text-embedding-004 is not available on v1beta API endpoint.
            # models/embedding-001 is the stable production model that works on v1beta.
            embeddings = GoogleGenerativeAIEmbeddings(
                model="models/embedding-001",
                google_api_key=google_api_key
            )
            print("✅ Google Gemini Embeddings loaded.")
        except Exception as e:
            print(f"❌ Embeddings error: {e}")

    if llm is None:
        try:
            api_key = os.getenv("GROQ_API_KEY")
            if not api_key:
                raise ValueError("GROQ_API_KEY not found in .env")

            llm = ChatGroq(
                temperature=0,
                groq_api_key=api_key,
                model_name="llama-3.1-70b-versatile"  # Upgraded from 8b for better quality
            )
            print("✅ Groq LLM initialized.")
        except Exception as e:
            print(f"❌ LLM error: {e}")


@app.route('/health', methods=['GET'])
def health():
    return jsonify({
        'status': 'ok',
        'pdf_loaded': db is not None,
        'embeddings_ready': embeddings is not None,
        'llm_ready': llm is not None
    }), 200


@app.route('/upload_pdf', methods=['POST'])
def upload_pdf():
    global db

    if 'pdf' not in request.files:
        return jsonify({'message': 'No PDF file provided'}), 400

    file = request.files['pdf']
    if not file or file.filename == '':
        return jsonify({'message': 'No file selected'}), 400

    if not file.filename.lower().endswith('.pdf'):
        return jsonify({'message': 'Only PDF files are allowed.'}), 400

    # Check file size server-side
    file.seek(0, 2)
    file_size = file.tell()
    file.seek(0)

    if file_size > MAX_FILE_SIZE:
        size_mb = round(file_size / (1024 * 1024), 1)
        return jsonify({'message': f'File is {size_mb}MB — maximum is 10MB.'}), 400

    temp_path = None
    try:
        if embeddings is None:
            load_resources()

        if embeddings is None:
            return jsonify({'message': 'Embedding service unavailable. Check GOOGLE_API_KEY.'}), 500

        with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as temp_file:
            temp_path = temp_file.name
            file.save(temp_path)

        loader = PyPDFLoader(temp_path)
        documents = loader.load()

        if not documents:
            return jsonify({'message': 'Could not extract text from PDF. Is it scanned?'}), 400

        # Larger chunks = fewer API calls = faster embedding
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=2000,
            chunk_overlap=200,
            separators=["\n\n", "\n", ". ", "! ", "? ", ", ", " ", ""]
        )
        chunks = splitter.split_documents(documents)
        total_chunks = len(chunks)
        print(f"📄 {len(documents)} pages → {total_chunks} chunks")

        # Larger batches (10 vs 3) + shorter delay (0.5s vs 3s) = ~6x faster
        batch_size = 10
        db = None

        for i in range(0, total_chunks, batch_size):
            batch = chunks[i: i + batch_size]
            if db is None:
                db = FAISS.from_documents(batch, embeddings)
            else:
                db.add_documents(batch)

            batch_num = i // batch_size + 1
            total_batches = (total_chunks + batch_size - 1) // batch_size
            print(f"  Batch {batch_num}/{total_batches} embedded")

            # Respect rate limits but don't over-sleep
            if i + batch_size < total_chunks:
                time.sleep(0.5)

        return jsonify({
            'message': f'"{file.filename}" embedded successfully!',
            'chunks': total_chunks,
            'pages': len(documents)
        }), 200

    except Exception as e:
        print(f"❌ Upload error: {e}")
        db = None  # Reset on failure so stale data isn't used
        return jsonify({'message': f'Processing failed: {str(e)}'}), 500
    finally:
        if temp_path and os.path.exists(temp_path):
            os.remove(temp_path)


@app.route('/ask_pdf', methods=['POST'])
def ask_pdf():
    data = request.get_json()
    if not data:
        return jsonify({'message': 'Invalid request body'}), 400

    query = data.get('query', '').strip()
    if not query:
        return jsonify({'message': 'No query provided'}), 400

    if db is None:
        return jsonify({'message': 'Please upload a PDF first.'}), 400

    if llm is None:
        load_resources()
        if llm is None:
            return jsonify({'message': 'LLM service unavailable. Check GROQ_API_KEY.'}), 500

    try:
        prompt = ChatPromptTemplate.from_template("""
You are an expert document analyst. Answer the question using ONLY the provided context.
Be accurate, concise, and well-structured. Use bullet points or numbered lists when helpful.
If the answer is not in the context, say: "This information is not available in the provided document."

<context>
{context}
</context>

Question: {input}

Answer:""")

        document_chain = create_stuff_documents_chain(llm, prompt)

        # MMR retrieval gives more diverse, relevant results than plain similarity search
        retriever = db.as_retriever(
            search_type="mmr",
            search_kwargs={"k": 5, "fetch_k": 12, "lambda_mult": 0.6}
        )
        retrieval_chain = create_retrieval_chain(retriever, document_chain)

        start_time = time.time()
        response = retrieval_chain.invoke({"input": query})
        latency = round(time.time() - start_time, 2)

        return jsonify({
            'response': response["answer"],
            'metrics': {
                'latency': latency,
                'provider': 'Groq Cloud',
                'model': 'Llama-3.1-70b'
            }
        }), 200

    except Exception as e:
        print(f"❌ Query error: {e}")
        return jsonify({'message': f'Query failed: {str(e)}'}), 500


if __name__ == '__main__':
    load_resources()
    port = int(os.environ.get("PORT", 5000))
    app.run(host='0.0.0.0', port=port, debug=False)