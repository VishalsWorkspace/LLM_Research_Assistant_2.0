const { useState, useRef, useCallback, useEffect } = React;

// ── Tiny markdown renderer (bold, bullets, numbered lists) ──────────────────
const RenderResponse = ({ text }) => {
    const lines = text.split('\n');
    return (
        <div className="response-body">
            {lines.map((line, i) => {
                if (!line.trim()) return <div key={i} className="spacer" />;

                // Numbered list
                const numMatch = line.match(/^(\d+)\.\s+(.*)/);
                if (numMatch) return (
                    <div key={i} className="list-item numbered">
                        <span className="list-num">{numMatch[1]}.</span>
                        <span dangerouslySetInnerHTML={{ __html: boldify(numMatch[2]) }} />
                    </div>
                );

                // Bullet
                const bulletMatch = line.match(/^[-•*]\s+(.*)/);
                if (bulletMatch) return (
                    <div key={i} className="list-item bulleted">
                        <span className="bullet-dot">▸</span>
                        <span dangerouslySetInnerHTML={{ __html: boldify(bulletMatch[1]) }} />
                    </div>
                );

                return <p key={i} dangerouslySetInnerHTML={{ __html: boldify(line) }} />;
            })}
        </div>
    );
};

const boldify = (str) =>
    str.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
       .replace(/`(.*?)`/g, '<code>$1</code>');

// ── Format bytes ────────────────────────────────────────────────────────────
const fmtSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

// ── Main App ────────────────────────────────────────────────────────────────
const App = () => {
    const [query, setQuery]           = useState('');
    const [response, setResponse]     = useState('');
    const [loading, setLoading]       = useState(false);
    const [uploadLoading, setUploadLoading] = useState(false);
    const [metrics, setMetrics]       = useState(null);
    const [pdfFile, setPdfFile]       = useState(null);
    const [pdfMeta, setPdfMeta]       = useState(null);   // { pages, chunks }
    const [message, setMessage]       = useState({ text: '', type: '' });
    const [dragOver, setDragOver]     = useState(false);
    const [copied, setCopied]         = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [queryHistory, setQueryHistory] = useState([]);
    const responseRef = useRef(null);
    const textareaRef = useRef(null);

    const API_BASE_URL = 'https://llm-research-assistant-2-0.onrender.com';
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

    // Auto-scroll to response
    useEffect(() => {
        if (response && responseRef.current) {
            responseRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    }, [response]);

    const showMessage = (text, type) => setMessage({ text, type });
    const clearMessage = () => setMessage({ text: '', type: '' });

    const processFile = useCallback(async (file) => {
        if (!file) return;

        if (file.type !== 'application/pdf') {
            showMessage('Please upload a PDF file.', 'error');
            return;
        }
        if (file.size > MAX_FILE_SIZE) {
            showMessage(`File is ${fmtSize(file.size)} — maximum is 10 MB.`, 'error');
            return;
        }

        setPdfFile(file);
        setPdfMeta(null);
        setResponse('');
        setMetrics(null);
        setQueryHistory([]);
        showMessage(`Vectorising "${file.name}"…`, 'info');
        setUploadLoading(true);
        setUploadProgress(0);

        // Fake progress bar while server does the real work
        const ticker = setInterval(() => {
            setUploadProgress(p => p < 88 ? p + Math.random() * 6 : p);
        }, 400);

        const formData = new FormData();
        formData.append('pdf', file);

        try {
            const res = await fetch(`${API_BASE_URL}/upload_pdf`, {
                method: 'POST',
                body: formData,
            });
            const data = await res.json();
            clearInterval(ticker);
            setUploadProgress(100);

            if (res.ok) {
                setPdfMeta({ pages: data.pages, chunks: data.chunks });
                showMessage('Document embedded — ready to query!', 'success');
            } else {
                showMessage(data.message || 'Upload failed.', 'error');
                setPdfFile(null);
            }
        } catch {
            clearInterval(ticker);
            showMessage('Connection error. Please wait 10s and retry.', 'error');
            setPdfFile(null);
        } finally {
            setUploadLoading(false);
            setTimeout(() => setUploadProgress(0), 800);
        }
    }, []);

    const handleFileInput = (e) => processFile(e.target.files[0]);

    const handleDrop = (e) => {
        e.preventDefault();
        setDragOver(false);
        processFile(e.dataTransfer.files[0]);
    };

    const handleQuery = async () => {
        if (!query.trim() || !pdfFile || loading) return;
        setLoading(true);
        setResponse('');
        setMetrics(null);
        clearMessage();

        try {
            const res = await fetch(`${API_BASE_URL}/ask_pdf`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query }),
            });
            const data = await res.json();

            if (res.ok) {
                setResponse(data.response);
                setMetrics(data.metrics);
                setQueryHistory(h => [{ q: query, a: data.response, metrics: data.metrics }, ...h.slice(0, 4)]);
            } else {
                showMessage(data.message || 'Query failed.', 'error');
            }
        } catch {
            showMessage('Backend error — the server may be restarting. Try again shortly.', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) handleQuery();
    };

    const copyResponse = async () => {
        await navigator.clipboard.writeText(response);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const resetAll = () => {
        setPdfFile(null); setPdfMeta(null); setResponse(''); setMetrics(null);
        setQuery(''); clearMessage(); setQueryHistory([]);
    };

    return (
        <>
        <style>{`
            @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Mono:wght@400;500&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,400&display=swap');
            *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
            :root {
                --bg:       #080b12;
                --surface:  #0e1420;
                --border:   rgba(255,255,255,0.07);
                --accent:   #6c63ff;
                --accent2:  #e040fb;
                --green:    #00e5a0;
                --red:      #ff4d6d;
                --amber:    #fbbf24;
                --text:     #e2e8f0;
                --muted:    #64748b;
                --radius:   14px;
            }
            body { background: var(--bg); font-family: 'DM Sans', sans-serif; color: var(--text); }
            h1, h2, h3 { font-family: 'Syne', sans-serif; }
            code { font-family: 'DM Mono', monospace; background: rgba(108,99,255,.15); padding: 2px 6px; border-radius: 4px; font-size: 0.85em; }

            /* Layout */
            .page   { min-height: 100vh; display: flex; flex-direction: column; align-items: center; padding: 56px 16px 80px; position: relative; overflow-x: hidden; }
            .main   { width: 100%; max-width: 760px; display: flex; flex-direction: column; gap: 20px; position: relative; z-index: 1; }

            /* Ambient blobs */
            .blob { position: fixed; border-radius: 50%; filter: blur(120px); pointer-events: none; z-index: 0; }
            .blob-1 { width: 500px; height: 500px; top: -150px; left: -150px; background: rgba(108,99,255,.22); }
            .blob-2 { width: 400px; height: 400px; bottom: -100px; right: -100px; background: rgba(224,64,251,.18); }

            /* Header */
            .header { text-align: center; margin-bottom: 32px; z-index: 1; }
            .badge  { display: inline-flex; align-items: center; gap: 6px; padding: 5px 14px; border-radius: 999px; border: 1px solid rgba(108,99,255,.35); background: rgba(108,99,255,.1); color: #a5b4fc; font-size: 11px; font-weight: 600; letter-spacing: .06em; text-transform: uppercase; margin-bottom: 16px; }
            .badge::before { content: ''; width: 7px; height: 7px; border-radius: 50%; background: var(--accent); animation: pulse 2s ease-in-out infinite; }
            @keyframes pulse { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.5;transform:scale(1.3)} }
            .title  { font-size: clamp(2rem, 5vw, 3.2rem); font-weight: 800; background: linear-gradient(135deg, #a5b4fc 0%, #e879f9 60%, #818cf8 100%); -webkit-background-clip: text; -webkit-text-fill-color: transparent; line-height: 1.15; margin-bottom: 12px; }
            .subtitle { font-size: 1rem; color: var(--muted); max-width: 460px; margin: 0 auto; line-height: 1.6; }

            /* Cards */
            .card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 24px; position: relative; overflow: hidden; }
            .card::before { content: ''; position: absolute; inset: 0; border-radius: var(--radius); background: linear-gradient(135deg, rgba(108,99,255,.04), transparent 60%); pointer-events: none; }

            .step-label { display: flex; align-items: center; gap: 10px; margin-bottom: 6px; }
            .step-num   { width: 28px; height: 28px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 12px; font-weight: 700; font-family: 'DM Mono', monospace; flex-shrink: 0; }
            .step-num.a { background: rgba(108,99,255,.2); color: #a5b4fc; }
            .step-num.b { background: rgba(224,64,251,.2); color: #e879f9; }
            .step-title { font-size: 1rem; font-weight: 700; color: var(--text); }
            .step-hint  { font-size: 11.5px; color: var(--muted); margin-bottom: 16px; padding-left: 38px; }

            /* Drop zone */
            .drop-zone  { border: 2px dashed rgba(255,255,255,.12); border-radius: 10px; padding: 28px 20px; display: flex; flex-direction: column; align-items: center; gap: 8px; cursor: pointer; transition: all .2s; position: relative; text-align: center; }
            .drop-zone:hover, .drop-zone.drag { border-color: var(--accent); background: rgba(108,99,255,.06); }
            .drop-zone.loaded { border-color: rgba(0,229,160,.4); background: rgba(0,229,160,.04); }
            .drop-zone input { position: absolute; inset: 0; opacity: 0; cursor: pointer; width: 100%; height: 100%; }
            .drop-icon { font-size: 28px; }
            .drop-primary { font-size: 0.875rem; font-weight: 500; color: var(--text); }
            .drop-secondary { font-size: 0.75rem; color: var(--muted); }

            .file-info { display: flex; align-items: center; gap: 10px; padding: 10px 14px; background: rgba(0,229,160,.06); border: 1px solid rgba(0,229,160,.2); border-radius: 8px; margin-top: 12px; }
            .file-name { font-size: 0.85rem; font-weight: 500; color: var(--green); flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
            .file-badges { display: flex; gap: 6px; flex-shrink: 0; }
            .pill { padding: 2px 8px; border-radius: 999px; font-size: 10.5px; font-weight: 600; font-family: 'DM Mono', monospace; }
            .pill-green { background: rgba(0,229,160,.15); color: var(--green); border: 1px solid rgba(0,229,160,.25); }
            .pill-purple { background: rgba(108,99,255,.15); color: #a5b4fc; border: 1px solid rgba(108,99,255,.25); }
            .pill-red { background: rgba(255,77,109,.12); color: var(--red); border: 1px solid rgba(255,77,109,.25); cursor: pointer; }

            /* Progress bar */
            .progress-wrap { margin-top: 12px; height: 3px; background: rgba(255,255,255,.07); border-radius: 99px; overflow: hidden; }
            .progress-bar  { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: 99px; transition: width .3s ease; }

            /* Textarea */
            .query-box { width: 100%; padding: 14px 16px; background: rgba(0,0,0,.3); color: var(--text); border: 1px solid var(--border); border-radius: 10px; font-family: 'DM Sans', sans-serif; font-size: 0.9rem; line-height: 1.6; resize: vertical; min-height: 120px; outline: none; transition: border-color .2s; }
            .query-box::placeholder { color: var(--muted); }
            .query-box:focus { border-color: rgba(108,99,255,.5); }
            .query-box:disabled { opacity: .4; cursor: not-allowed; }
            .query-footer { display: flex; justify-content: space-between; align-items: center; margin-top: 8px; }
            .char-count { font-size: 11px; color: var(--muted); font-family: 'DM Mono', monospace; }
            .hint-text  { font-size: 11px; color: var(--muted); }

            /* Buttons */
            .btn-primary { width: 100%; padding: 14px; border-radius: 10px; font-family: 'Syne', sans-serif; font-weight: 700; font-size: 0.95rem; letter-spacing: .02em; border: none; cursor: pointer; transition: all .2s; display: flex; align-items: center; justify-content: center; gap: 8px; }
            .btn-primary.active { background: linear-gradient(135deg, var(--accent), var(--accent2)); color: #fff; box-shadow: 0 4px 20px rgba(108,99,255,.35); }
            .btn-primary.active:hover { transform: translateY(-1px); box-shadow: 0 6px 28px rgba(108,99,255,.45); }
            .btn-primary.disabled { background: rgba(255,255,255,.05); color: var(--muted); cursor: not-allowed; }
            .btn-primary.loading { background: linear-gradient(135deg, rgba(108,99,255,.5), rgba(224,64,251,.5)); color: rgba(255,255,255,.7); cursor: wait; }

            .btn-sm { padding: 5px 12px; border-radius: 6px; font-size: 11.5px; font-weight: 600; border: 1px solid var(--border); background: rgba(255,255,255,.04); color: var(--muted); cursor: pointer; transition: all .15s; font-family: 'DM Mono', monospace; }
            .btn-sm:hover { background: rgba(255,255,255,.08); color: var(--text); }
            .btn-sm.green { border-color: rgba(0,229,160,.3); color: var(--green); }

            /* Spinner */
            .spinner { width: 16px; height: 16px; border: 2px solid rgba(255,255,255,.2); border-top-color: #fff; border-radius: 50%; animation: spin .7s linear infinite; }
            @keyframes spin { to { transform: rotate(360deg); } }

            /* Message banner */
            .banner { padding: 12px 18px; border-radius: 10px; font-size: 0.875rem; font-weight: 500; display: flex; align-items: center; gap: 10px; }
            .banner.error   { background: rgba(255,77,109,.08); border: 1px solid rgba(255,77,109,.25); color: #fca5a5; }
            .banner.success { background: rgba(0,229,160,.07); border: 1px solid rgba(0,229,160,.2); color: var(--green); }
            .banner.info    { background: rgba(108,99,255,.08); border: 1px solid rgba(108,99,255,.2); color: #a5b4fc; }

            /* Response card */
            .response-card { background: var(--surface); border: 1px solid rgba(108,99,255,.2); border-radius: var(--radius); padding: 24px; animation: slideUp .35s ease; }
            @keyframes slideUp { from{opacity:0;transform:translateY(12px)} to{opacity:1;transform:translateY(0)} }
            .response-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; padding-bottom: 14px; border-bottom: 1px solid var(--border); }
            .response-title { font-size: 0.9rem; font-weight: 700; color: var(--text); display: flex; align-items: center; gap: 8px; }
            .response-title::before { content: ''; width: 8px; height: 8px; border-radius: 50%; background: var(--accent); flex-shrink: 0; }
            .response-meta  { display: flex; align-items: center; gap: 8px; }
            .latency-badge  { padding: 3px 10px; border-radius: 999px; background: rgba(0,0,0,.3); border: 1px solid var(--border); font-size: 11px; font-family: 'DM Mono', monospace; color: var(--muted); }

            /* Response body */
            .response-body { font-size: 0.9rem; line-height: 1.75; color: #cbd5e1; }
            .response-body p { margin-bottom: 10px; }
            .response-body p:last-child { margin-bottom: 0; }
            .response-body .spacer { height: 6px; }
            .list-item { display: flex; gap: 10px; margin-bottom: 6px; }
            .list-num  { color: var(--accent); font-weight: 700; font-family: 'DM Mono', monospace; min-width: 22px; flex-shrink: 0; }
            .bullet-dot { color: var(--accent2); font-size: 0.65em; margin-top: 5px; flex-shrink: 0; }
            strong { color: var(--text); font-weight: 600; }

            /* Disabled card */
            .card.dim { opacity: .45; pointer-events: none; }

            /* Footer reset link */
            .reset-btn { background: none; border: none; color: var(--muted); font-size: 11.5px; cursor: pointer; text-decoration: underline; padding: 0; font-family: 'DM Sans', sans-serif; transition: color .15s; }
            .reset-btn:hover { color: var(--text); }
        `}</style>

        <div className="page">
            <div className="blob blob-1" />
            <div className="blob blob-2" />

            {/* Header */}
            <header className="header">
                <div className="badge">Production RAG · v2</div>
                <h1 className="title">Cloud Document Intelligence</h1>
                <p className="subtitle">Upload any PDF up to 10 MB and query it with AI — powered by Groq's Llama 3.1 70B.</p>
            </header>

            <main className="main">

                {/* Step 1 — Upload */}
                <div className="card">
                    <div className="step-label">
                        <span className="step-num a">1</span>
                        <span className="step-title">Upload Knowledge Base</span>
                    </div>
                    <p className="step-hint">PDF up to 10 MB. Pages are chunked &amp; embedded for semantic search.</p>

                    <div
                        className={`drop-zone ${dragOver ? 'drag' : ''} ${pdfFile ? 'loaded' : ''}`}
                        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                        onDragLeave={() => setDragOver(false)}
                        onDrop={handleDrop}
                    >
                        <input type="file" accept=".pdf" onChange={handleFileInput} disabled={uploadLoading} />
                        {pdfFile ? (
                            <>
                                <span className="drop-icon">✅</span>
                                <span className="drop-primary">{pdfFile.name}</span>
                                <span className="drop-secondary">{fmtSize(pdfFile.size)} — click to replace</span>
                            </>
                        ) : (
                            <>
                                <span className="drop-icon">📄</span>
                                <span className="drop-primary">Drag &amp; drop or click to browse</span>
                                <span className="drop-secondary">PDF only · max 10 MB</span>
                            </>
                        )}
                    </div>

                    {uploadLoading && (
                        <div className="progress-wrap">
                            <div className="progress-bar" style={{ width: `${uploadProgress}%` }} />
                        </div>
                    )}

                    {pdfMeta && !uploadLoading && (
                        <div className="file-info">
                            <span className="file-name">📚 {pdfFile.name}</span>
                            <div className="file-badges">
                                <span className="pill pill-green">{pdfMeta.pages}p</span>
                                <span className="pill pill-purple">{pdfMeta.chunks} chunks</span>
                                <span className="pill pill-red" onClick={resetAll}>✕</span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Step 2 — Query */}
                <div className={`card ${!pdfFile || uploadLoading ? 'dim' : ''}`}>
                    <div className="step-label">
                        <span className="step-num b">2</span>
                        <span className="step-title">Query the Document</span>
                    </div>
                    <p className="step-hint">Ask anything about the PDF. Press Ctrl+Enter to submit.</p>

                    <textarea
                        ref={textareaRef}
                        className="query-box"
                        placeholder="e.g. What are the key findings? Summarise section 3. What methodology was used?"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={loading || !pdfFile}
                        rows={4}
                    />
                    <div className="query-footer">
                        <span className="char-count">{query.length} chars</span>
                        <span className="hint-text">Ctrl+Enter to submit</span>
                    </div>

                    <button
                        className={`btn-primary ${loading ? 'loading' : !pdfFile || !query.trim() ? 'disabled' : 'active'}`}
                        style={{ marginTop: 14 }}
                        onClick={handleQuery}
                        disabled={loading || !pdfFile || !query.trim()}
                    >
                        {loading ? (
                            <><div className="spinner" /> Synthesising answer…</>
                        ) : (
                            '⚡ Synthesise Answer'
                        )}
                    </button>
                </div>

                {/* Status banner */}
                {message.text && (
                    <div className={`banner ${message.type}`}>
                        {message.type === 'error' ? '⚠️' : message.type === 'success' ? '✅' : '🔵'}
                        {message.text}
                    </div>
                )}

                {/* Response */}
                {response && (
                    <div className="response-card" ref={responseRef}>
                        <div className="response-header">
                            <span className="response-title">AI Synthesis</span>
                            <div className="response-meta">
                                {metrics && (
                                    <span className="latency-badge">{metrics.latency}s · {metrics.model}</span>
                                )}
                                <button className={`btn-sm ${copied ? 'green' : ''}`} onClick={copyResponse}>
                                    {copied ? '✓ Copied' : 'Copy'}
                                </button>
                            </div>
                        </div>
                        <RenderResponse text={response} />
                    </div>
                )}

                {/* Reset footer */}
                {pdfFile && (
                    <div style={{ textAlign: 'center', paddingTop: 4 }}>
                        <button className="reset-btn" onClick={resetAll}>
                            Start over with a new document
                        </button>
                    </div>
                )}

            </main>
        </div>
        </>
    );
};

const rootElement = document.getElementById('root');
const root = ReactDOM.createRoot(rootElement);
root.render(<React.StrictMode><App /></React.StrictMode>);