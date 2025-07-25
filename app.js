    import React, { useState, useEffect, useRef } from 'react';

    // Main App component for the Offline LLM-Powered PDF Assistant
    const App = () => {
        // State variables for managing UI elements and data
        const [query, setQuery] = useState(''); // Stores the user's input query
        const [response, setResponse] = useState(''); // Stores the LLM's response
        const [loading, setLoading] = useState(false); // Indicates if a query is being processed
        const [metrics, setMetrics] = useState(null); // Stores LLM performance metrics
        const [pdfFile, setPdfFile] = useState(null); // Stores the selected PDF file
        const [showUploadModal, setShowUploadModal] = useState(false); // Controls visibility of PDF upload modal
        const [recentPdfs, setRecentPdfs] = useState([]); // Stores a list of recently used PDFs (mock data for now)
        const [message, setMessage] = useState({ text: '', type: '' }); // For displaying success/error messages

        // Ref for the file input element to programmatically trigger click
        const fileInputRef = useRef(null);

        // Backend API URL - IMPORTANT: Ensure this matches your Flask backend URL
        const API_BASE_URL = 'http://localhost:5000'; // Flask backend runs on port 5000 by default

        // Function to handle file selection and upload to backend
        const handleFileChange = async (event) => {
            const file = event.target.files[0];
            if (file && file.type === 'application/pdf') {
                setPdfFile(file);
                setShowUploadModal(false);
                setMessage({ text: `Uploading and processing "${file.name}"...`, type: 'info' });
                setLoading(true); // Set loading true for file upload process

                const formData = new FormData();
                formData.append('pdf', file); // Append the PDF file to form data

                try {
                    const response = await fetch(`${API_BASE_URL}/upload_pdf`, {
                        method: 'POST',
                        body: formData, // Send form data with the PDF
                    });

                    const data = await response.json(); // Parse JSON response from backend

                    if (response.ok) { // Check if the response status is 200 OK
                        setMessage({ text: data.message, type: 'success' });
                        // Add to recent PDFs, ensuring uniqueness and limiting list size
                        setRecentPdfs(prev => {
                            const newPdf = { id: Date.now(), name: file.name };
                            // Filter out existing PDF with the same name before adding new one
                            const updatedPdfs = [newPdf, ...prev.filter(p => p.name !== file.name)].slice(0, 5);
                            return updatedPdfs;
                        });
                    } else {
                        // Handle server-side errors
                        setMessage({ text: `Error: ${data.message || 'Failed to upload PDF.'}`, type: 'error' });
                        setPdfFile(null); // Clear PDF if upload fails
                    }
                } catch (error) {
                    // Handle network errors
                    console.error('Network error during PDF upload:', error);
                    setMessage({ text: `Network error: ${error.message}. Is the backend running?`, type: 'error' });
                    setPdfFile(null);
                } finally {
                    setLoading(false); // End loading regardless of success or failure
                }
            } else {
                setMessage({ text: 'Please select a valid PDF file.', type: 'error' });
            }
        };

        // Function to send query to backend and get LLM response
        const handleQuery = async () => {
            if (!query.trim()) {
                setMessage({ text: 'Please enter a question.', type: 'error' });
                return;
            }
            if (!pdfFile) {
                setMessage({ text: 'Please upload a PDF first.', type: 'error' });
                return;
            }

            setLoading(true);
            setResponse('');
            setMetrics(null);
            setMessage({ text: '', type: '' }); // Clear previous messages

            try {
                const response = await fetch(`${API_BASE_URL}/ask_pdf`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json', // Specify content type for JSON payload
                    },
                    body: JSON.stringify({ query: query }), // Send query as JSON
                });

                const data = await response.json();

                if (response.ok) {
                    setResponse(data.response);
                    setMetrics(data.metrics);
                    setMessage({ text: 'Response generated successfully!', type: 'success' });
                } else {
                    setMessage({ text: `Error: ${data.message || 'Failed to get response.'}`, type: 'error' });
                }
            } catch (error) {
                console.error('Network error during LLM inference:', error);
                setMessage({ text: `Network error: ${error.message}. Is the backend running?`, type: 'error' });
            } finally {
                setLoading(false);
            }
        };

        // Function to copy response to clipboard
        const copyToClipboard = () => {
            if (response) {
                const textarea = document.createElement('textarea');
                textarea.value = response;
                document.body.appendChild(textarea);
                textarea.select();
                try {
                    document.execCommand('copy'); // Use document.execCommand for broader compatibility in iframes
                    setMessage({ text: 'Response copied to clipboard!', type: 'success' });
                } catch (err) {
                    setMessage({ text: 'Failed to copy text.', type: 'error' });
                    console.error('Failed to copy text: ', err);
                }
                document.body.removeChild(textarea);
            }
        };

        // Effect to clear messages after a few seconds
        useEffect(() => {
            if (message.text) {
                const timer = setTimeout(() => {
                    setMessage({ text: '', type: '' });
                }, 5000);
                return () => clearTimeout(timer);
            }
        }, [message]);

        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 to-gray-800 text-gray-100 font-inter p-4 sm:p-8 flex flex-col items-center">
                {/* Header Section */}
                <header className="w-full max-w-4xl text-center mb-8">
                    <h1 className="text-4xl sm:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600 mb-2">
                        📄 Offline AI-Powered PDF Assistant
                    </h1>
                    <p className="text-lg sm:text-xl text-gray-400">
                        Your secure, local research companion. Ask anything from your PDFs.
                    </p>
                </header>

                {/* Main Content Area */}
                <main className="w-full max-w-4xl bg-gray-800 rounded-xl shadow-2xl p-6 sm:p-8 space-y-8 border border-gray-700">

                    {/* PDF Management Section */}
                    <section className="bg-gray-700 p-6 rounded-lg shadow-inner border border-gray-600">
                        <h2 className="text-2xl font-semibold text-gray-200 mb-4 flex items-center">
                            <svg className="w-6 h-6 mr-2 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path></svg>
                            Manage PDFs
                        </h2>
                        <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                            <div className="flex-1 w-full">
                                {pdfFile ? (
                                    <div className="flex items-center bg-gray-600 text-gray-200 p-3 rounded-md border border-gray-500">
                                        <svg className="w-5 h-5 mr-2 text-green-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"></path></svg>
                                        <span>Loaded: <span className="font-medium">{pdfFile.name}</span></span>
                                        <button
                                            onClick={() => setPdfFile(null)}
                                            className="ml-auto text-red-300 hover:text-red-500 transition-colors duration-200"
                                            title="Remove PDF"
                                        >
                                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                                        </button>
                                    </div>
                                ) : (
                                    <p className="text-gray-400 italic">No PDF loaded. Please upload one to start.</p>
                                )}
                            </div>
                            <button
                                onClick={() => setShowUploadModal(true)}
                                className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold rounded-lg shadow-lg hover:from-blue-600 hover:to-indigo-700 transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"></path></svg>
                                Upload PDF
                            </button>
                        </div>

                        {/* Recent PDFs */}
                        {recentPdfs.length > 0 && (
                            <div className="mt-6 pt-4 border-t border-gray-600">
                                <h3 className="text-xl font-semibold text-gray-200 mb-3">Recent PDFs</h3>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                    {recentPdfs.map(pdf => (
                                        <button
                                            key={pdf.id}
                                            onClick={() => {
                                                // Simulate loading a recent PDF
                                                setPdfFile({ name: pdf.name, type: 'application/pdf' });
                                                setMessage({ text: `Loaded "${pdf.name}" from recent files.`, type: 'info' });
                                            }}
                                            className="flex items-center bg-gray-600 hover:bg-gray-500 text-gray-200 p-3 rounded-md border border-gray-500 transition-colors duration-200 text-left"
                                        >
                                            <svg className="w-5 h-5 mr-2 text-blue-400" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg"><path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4zm2 6a1 1 0 011-1h6a1 1 0 110 2H7a1 1 0 01-1-1zm1 3a1 1 0 100 2h6a1 1 0 100-2H7z" clipRule="evenodd"></path></svg>
                                            <span className="truncate">{pdf.name}</span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </section>

                    {/* Query Input Section */}
                    <section className="bg-gray-700 p-6 rounded-lg shadow-inner border border-gray-600">
                        <h2 className="text-2xl font-semibold text-gray-200 mb-4 flex items-center">
                            <svg className="w-6 h-6 mr-2 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8.228 9.247a4.75 4.75 0 010 5.506L7.24 16.732a2.5 2.5 0 000 3.536l1.018 1.018a2.5 2.5 0 003.536 0L15.753 17.772a4.75 4.75 0 000-5.506l-1.018-1.018a2.5 2.5 0 00-3.536 0L8.228 9.247zM16.732 7.24a2.5 2.5 0 00-3.536 0L8.228 8.228a4.75 4.75 0 000 5.506l1.018 1.018a2.5 2.5 0 003.536 0l1.018-1.018a4.75 4.75 0 000-5.506l-1.018-1.018z"></path></svg>
                            Ask a Question
                        </h2>
                        <textarea
                            className="w-full p-4 bg-gray-600 text-gray-100 rounded-lg border border-gray-500 focus:ring-2 focus:ring-purple-500 focus:border-transparent outline-none resize-y min-h-[100px]"
                            placeholder={pdfFile ? "Ask a question from your loaded PDF..." : "Please load a PDF first to ask questions."}
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            disabled={loading || !pdfFile}
                        ></textarea>
                        <button
                            onClick={handleQuery}
                            disabled={loading || !pdfFile}
                            className={`w-full mt-4 px-6 py-3 font-bold rounded-lg shadow-lg transition-all duration-300 transform ${
                                loading || !pdfFile
                                    ? 'bg-gray-500 cursor-not-allowed'
                                    : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white hover:from-purple-600 hover:to-pink-600 hover:scale-105'
                            } flex items-center justify-center`}
                        >
                            {loading ? (
                                <>
                                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                                    </svg>
                                    Processing...
                                </>
                            ) : (
                                <>
                                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6"></path></svg>
                                    Get Answer
                                </>
                            )}
                        </button>
                    </section>

                    {/* LLM Response Section */}
                    {response && (
                        <section className="bg-gray-700 p-6 rounded-lg shadow-inner border border-gray-600">
                            <h2 className="text-2xl font-semibold text-gray-200 mb-4 flex items-center">
                                <svg className="w-6 h-6 mr-2 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4.636 16.364l-.707.707M3 12H2m8.707-10.707l-.707.707M17 18v1m-4-5h2m-2 0h-2m-6 0h2m-2 0H6"></path></svg>
                                LLM Response
                            </h2>
                            <div className="bg-gray-600 p-4 rounded-lg text-gray-100 whitespace-pre-wrap border border-gray-500">
                                {response}
                            </div>
                            <button
                                onClick={copyToClipboard}
                                className="w-full mt-4 px-6 py-3 bg-gradient-to-r from-teal-500 to-cyan-600 text-white font-bold rounded-lg shadow-lg hover:from-teal-600 hover:to-cyan-700 transition-all duration-300 transform hover:scale-105 flex items-center justify-center"
                            >
                                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V19a2 2 0 01-2 2h-2.586a1 1 0 01-.707-.293l-3.414-3.414a1 1 0 01-.293-.707V5z"></path></svg>
                                Copy Response
                            </button>
                        </section>
                    )}

                    {/* LLM Metrics Section */}
                    {metrics && (
                        <section className="bg-gray-700 p-6 rounded-lg shadow-inner border border-gray-600">
                            <h2 className="text-2xl font-semibold text-gray-200 mb-4 flex items-center">
                                <svg className="w-6 h-6 mr-2 text-orange-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10a2 2 0 01-2 2h-2a2 2 0 01-2-2zm9 0V5a2 2 0 00-2-2h-2a2 2 0 00-2 2v14a2 2 0 002 2h2a2 2 0 002-2z"></path></svg>
                                LLM Performance Metrics
                            </h2>
                            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                                <div className="bg-gray-600 p-4 rounded-lg text-center border border-gray-500">
                                    <p className="text-gray-400 text-sm">⏱️ Inference Time</p>
                                    <p className="text-3xl font-bold text-purple-300 mt-1">{metrics.latency} sec</p>
                                </div>
                                <div className="bg-gray-600 p-4 rounded-lg text-center border border-gray-500">
                                    <p className="text-gray-400 text-sm">🧠 LLM CPU Usage</p>
                                    <p className="text-3xl font-bold text-pink-300 mt-1">{metrics.llm_cpu}%</p>
                                </div>
                                <div className="bg-gray-600 p-4 rounded-lg text-center border border-gray-500">
                                    <p className="text-gray-400 text-sm">💾 LLM RAM (RSS)</p>
                                    <p className="text-3xl font-bold text-teal-300 mt-1">{metrics.llm_mem_mb} MB</p>
                                </div>
                            </div>
                        </section>
                    )}

                    {/* Message Display */}
                    {message.text && (
                        <div className={`p-4 rounded-lg text-center font-medium ${
                            message.type === 'success' ? 'bg-green-500 text-white' :
                            message.type === 'error' ? 'bg-red-500 text-white' :
                            'bg-blue-500 text-white'
                        }`}>
                            {message.text}
                        </div>
                    )}
                </main>

                {/* PDF Upload Modal */}
                {showUploadModal && (
                    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-800 rounded-xl p-8 shadow-2xl border border-gray-700 w-full max-w-md">
                            <h3 className="text-2xl font-bold text-gray-100 mb-4">Upload Your PDF</h3>
                            <p className="text-gray-400 mb-6">Drag & drop your PDF here, or click to select a file.</p>
                            <div
                                className="border-2 border-dashed border-gray-600 rounded-lg p-10 text-center cursor-pointer hover:border-purple-500 transition-colors duration-200"
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                    e.preventDefault();
                                    handleFileChange({ target: { files: e.dataTransfer.files } });
                                }}
                                onClick={() => fileInputRef.current.click()}
                            >
                                <input
                                    type="file"
                                    accept=".pdf"
                                    onChange={handleFileChange}
                                    ref={fileInputRef}
                                    className="hidden"
                                />
                                <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a3 3 0 013 3v10a2 2 0 01-2 2H7a2 2 0 01-2-2V16a3 3 0 013-3z"></path></svg>
                                <p className="mt-2 text-gray-400">Drag & Drop or Click to Browse</p>
                            </div>
                            <button
                                onClick={() => setShowUploadModal(false)}
                                className="mt-6 w-full px-6 py-3 bg-gray-600 text-gray-200 font-bold rounded-lg shadow-md hover:bg-gray-500 transition-colors duration-200"
                            >
                                Cancel
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    };

    export default App;
    //