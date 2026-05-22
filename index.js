const App = () => {
    const [query, setQuery] = React.useState('');
    const [response, setResponse] = React.useState('');
    const [loading, setLoading] = React.useState(false);
    const [metrics, setMetrics] = React.useState(null);
    const [pdfFile, setPdfFile] = React.useState(null);
    const [message, setMessage] = React.useState({ text: '', type: '' });
    
    // Live Render backend URL
    const API_BASE_URL = 'https://llm-research-assistant-2-0.onrender.com'; 
    const MAX_FILE_SIZE = 1 * 1024 * 1024; // 1MB limit for free-tier stability

    const handleFileChange = async (event) => {
        const file = event.target.files[0];
        
        if (!file) return;

        // Validation: Ensure it's a PDF
        if (file.type !== 'application/pdf') {
            setMessage({ text: 'Invalid file format. Please upload a PDF.', type: 'error' });
            return;
        }

        // Validation: Enforce 1MB limit to prevent API rate-limit crashes
        if (file.size > MAX_FILE_SIZE) {
            setMessage({ text: 'File too large (Max 1MB). Please upload a smaller document for optimal performance.', type: 'error' });
            return;
        }

        setPdfFile(file);
        setMessage({ text: `Processing "${file.name}"... Initializing embedding vectors.`, type: 'info' });
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
                setMessage({ text: "Document successfully embedded!", type: 'success' });
            } else {
                setMessage({ text: `Error: ${data.message}.`, type: 'error' });
                setPdfFile(null);
            }
        } catch (error) {
            setMessage({ text: `Connection unstable. Please wait 10 seconds and try again.`, type: 'error' });
            setPdfFile(null);
        } finally {
            setLoading(false);
        }
    };

    const handleQuery = async () => {
        if (!query.trim() || !pdfFile) return;
        setLoading(true);
        setResponse('');
        setMetrics(null);
        setMessage({ text: '', type: '' });

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
            setMessage({ text: `Backend error. The server may be restarting.`, type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-950 text-slate-200 font-sans relative overflow-hidden flex flex-col items-center py-12 px-4 sm:px-8">
            <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-indigo-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-40"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-96 h-96 bg-fuchsia-600 rounded-full mix-blend-multiply filter blur-[128px] opacity-40"></div>

            <header className="w-full max-w-4xl text-center mb-12 z-10">
                <div className="inline-block px-4 py-1.5 rounded-full border border-indigo-500/30 bg-indigo-500/10 text-indigo-300 text-sm font-semibold tracking-wide mb-4">
                    Production RAG Architecture
                </div>
                <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-fuchsia-400 mb-4 tracking-tight">
                    Cloud Document Intelligence
                </h1>
                <p className="text-lg text-slate-400 max-w-2xl mx-auto leading-relaxed">
                    Instantly extract insights from technical manuals or research papers.
                </p>
            </header>

            <main className="w-full max-w-3xl z-10 space-y-6">
                <section className="bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-2xl">
                    <h2 className="text-xl font-bold text-slate-100 mb-2 flex items-center">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 text-sm mr-3">1</span>
                        Upload Knowledge Base
                    </h2>
                    <p className="text-xs text-slate-500 mb-4 ml-11">Max file size: 1MB. Files are vectorized for instant retrieval.</p>
                    
                    <div className="relative">
                        <input 
                            type="file" 
                            accept=".pdf" 
                            onChange={handleFileChange} 
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-20"
                            disabled={loading}
                        />
                        <div className={`w-full p-4 rounded-xl border-2 border-dashed flex items-center justify-center transition-all ${pdfFile ? 'border-emerald-500/50 bg-emerald-500/10' : 'border-slate-600 hover:border-indigo-500/50 bg-slate-800/50'}`}>
                            {pdfFile ? (
                                <span className="text-emerald-400 font-medium flex items-center">
                                    {pdfFile.name} Loaded
                                </span>
                            ) : (
                                <span className="text-slate-400">Drag & Drop or Click to Browse PDF</span>
                            )}
                        </div>
                    </div>
                </section>

                <section className={`bg-slate-900/50 backdrop-blur-xl border border-slate-700/50 rounded-2xl p-6 shadow-2xl transition-opacity duration-300 ${!pdfFile ? 'opacity-50 pointer-events-none' : 'opacity-100'}`}>
                    <h2 className="text-xl font-bold text-slate-100 mb-4 flex items-center">
                        <span className="flex items-center justify-center w-8 h-8 rounded-full bg-fuchsia-500/20 text-fuchsia-400 text-sm mr-3">2</span>
                        Query the LLM
                    </h2>
                    <textarea
                        className="w-full p-4 bg-slate-950/50 text-slate-200 rounded-xl border border-slate-700 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none resize-y min-h-[120px] placeholder-slate-500"
                        placeholder="e.g., What are the key technical requirements?"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        disabled={loading || !pdfFile}
                    ></textarea>
                    <button 
                        onClick={handleQuery} 
                        disabled={loading || !pdfFile || !query.trim()} 
                        className={`w-full mt-4 py-4 rounded-xl font-bold text-white transition-all shadow-lg flex justify-center items-center ${loading || !pdfFile || !query.trim() ? 'bg-slate-700 cursor-not-allowed text-slate-400' : 'bg-gradient-to-r from-indigo-600 to-fuchsia-600 hover:from-indigo-500 hover:to-fuchsia-500 hover:shadow-indigo-500/25'}`}
                    >
                        {loading ? 'Processing through Neural Network...' : 'Synthesize Answer'}
                    </button>
                </section>

                {message.text && (
                    <div className={`p-4 rounded-xl text-center font-medium border ${message.type === 'error' ? 'bg-red-500/10 border-red-500/50 text-red-400' : message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-blue-500/10 border-blue-500/50 text-blue-400'}`}>
                        {message.text}
                    </div>
                )}

                {response && (
                    <section className="bg-slate-900/80 backdrop-blur-xl border border-indigo-500/30 rounded-2xl p-6 shadow-2xl animate-fade-in-up">
                        <div className="flex items-center justify-between mb-4 pb-4 border-b border-slate-700">
                            <h3 className="text-lg font-bold text-slate-100 flex items-center">AI Synthesis</h3>
                            {metrics && (
                                <span className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1 rounded-full border border-slate-800">
                                    {metrics.latency}s | {metrics.model}
                                </span>
                            )}
                        </div>
                        <div className="text-slate-300 leading-relaxed whitespace-pre-wrap">{response}</div>
                    </section>
                )}
            </main>
        </div>
    );
};

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(<React.StrictMode><App /></React.StrictMode>);