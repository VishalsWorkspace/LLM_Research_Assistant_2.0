const App = () => {
    const [query, setQuery] = React.useState('');
    const [response, setResponse] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [metrics, setMetrics] = React.useState(null);
    const [pdfFile, setPdfFile] = React.useState(null);
    const [showUploadModal, setShowUploadModal] = React.useState(false);
    const [message, setMessage] = React.useState({ text: '', type: '' });
    const fileInputRef = React.useRef(null);

    // CHANGE THIS TO YOUR LIVE RENDER URL LATER
    const API_BASE_URL = 'https://llm-research-assistant-2-0.onrender.com'; 

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        if (file && file.type === 'application/pdf') {
            setPdfFile(file);
            setShowUploadModal(false);
            setMessage({ text: `Uploading "${file.name}"...`, type: 'info' });
            setLoading(true);

            const formData = new FormData();
            formData.append('pdf', file);

            try {
                const res = await fetch(`${API_BASE_URL}/upload_pdf`, {
                    method: 'POST',
                    body: formData,
                });
                const data = await res.json();
                if (res.ok) {
                    setMessage({ text: data.message, type: 'success' });
                } else {
                    setMessage({ text: `Error: ${data.message}`, type: 'error' });
                    setPdfFile(null);
                }
            } catch (error) {
                setMessage({ text: `Network error. Is the backend running?`, type: 'error' });
                setPdfFile(null);
            } finally {
                setLoading(false);
            }
        }
    };

    const handleQuery = async () => {
        if (!query.trim() || !pdfFile) return;
        setLoading(true);
        setResponse('');
        setMetrics(null);

        try {
            const res = await fetch(`${API_BASE_URL}/ask_pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: query }),
            });
            const data = await res.json();

            if (res.ok) {
                setResponse(data.response);
                setMetrics(data.metrics);
            } else {
                setMessage({ text: `Error: ${data.message}`, type: 'error' });
            }
        } catch (error) {
            setMessage({ text: `Network error.`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    React.useEffect(() => {
        if (message.text) {
            const timer = setTimeout(() => setMessage({ text: '', type: '' }), 5000);
            return () => clearTimeout(timer);
        }
    }, [message]);

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100 font-inter p-4 sm:p-8 flex flex-col items-center">
            <header className="w-full max-w-4xl text-center mb-8">
                <h1 className="text-4xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
                    📄 Cloud RAG Assistant
                </h1>
                <p className="text-lg text-gray-400">Powered by Llama 3 & FAISS Vector Search</p>
            </header>

            <main className="w-full max-w-4xl bg-gray-800 rounded-xl shadow-2xl p-6 space-y-8 border border-gray-700">
                <section className="bg-gray-700 p-6 rounded-lg border border-gray-600">
                    <div className="flex flex-col sm:flex-row justify-between gap-4">
                        <div className="flex-1 w-full">
                            {pdfFile ? (
                                <div className="p-3 bg-gray-600 text-green-400 rounded-md border border-gray-500">
                                    Loaded: {pdfFile.name}
                                </div>
                            ) : (
                                <p className="text-gray-400 italic">No PDF loaded.</p>
                            )}
                        </div>
                        <button onClick={() => setShowUploadModal(true)} className="px-6 py-3 bg-blue-600 text-white font-bold rounded-lg hover:bg-blue-700">
                            Upload PDF
                        </button>
                    </div>
                </section>

                <section className="bg-gray-700 p-6 rounded-lg border border-gray-600">
                    <textarea
                        className="w-full p-4 bg-gray-600 text-white rounded-lg border border-gray-500 outline-none"
                        placeholder="Ask a question..."
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        disabled={loading || !pdfFile}
                    ></textarea>
                    <button onClick={handleQuery} disabled={loading || !pdfFile} className="w-full mt-4 px-6 py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-700">
                        {loading ? 'Processing...' : 'Get Answer'}
                    </button>
                </section>

                {response && (
                    <section className="bg-gray-700 p-6 rounded-lg border border-gray-600">
                        <div className="bg-gray-600 p-4 rounded-lg whitespace-pre-wrap">{response}</div>
                    </section>
                )}

                {metrics && (
                    <section className="grid grid-cols-3 gap-6">
                        <div className="bg-gray-700 p-4 rounded-lg text-center border border-gray-600">
                            <p className="text-gray-400 text-sm">Inference Latency</p>
                            <p className="text-2xl font-bold text-purple-300 mt-1">{metrics.latency}s</p>
                        </div>
                        <div className="bg-gray-700 p-4 rounded-lg text-center border border-gray-600">
                            <p className="text-gray-400 text-sm">Provider</p>
                            <p className="text-2xl font-bold text-pink-300 mt-1">{metrics.provider}</p>
                        </div>
                        <div className="bg-gray-700 p-4 rounded-lg text-center border border-gray-600">
                            <p className="text-gray-400 text-sm">Model</p>
                            <p className="text-2xl font-bold text-teal-300 mt-1">{metrics.model}</p>
                        </div>
                    </section>
                )}

                {message.text && (
                    <div className={`p-4 rounded-lg text-center font-medium ${message.type === 'error' ? 'bg-red-500' : 'bg-green-500'}`}>
                        {message.text}
                    </div>
                )}
            </main>

            {showUploadModal && (
                <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4">
                    <div className="bg-gray-800 p-8 rounded-xl w-full max-w-md text-center border border-gray-700">
                        <h3 className="text-2xl font-bold text-white mb-6">Select PDF</h3>
                        <input type="file" accept=".pdf" onChange={handleFileChange} className="text-white" />
                        <button onClick={() => setShowUploadModal(false)} className="mt-6 w-full py-2 bg-gray-600 text-white rounded-lg">Cancel</button>
                    </div>
                </div>
            )}
        </div>
    );
};

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(<React.StrictMode><App /></React.StrictMode>);