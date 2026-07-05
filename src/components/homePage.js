import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
import { v4 as uuidv4 } from "uuid";
import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { atomDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Copy, Check, MessageSquare, Plus, Menu, X, Send, Trash2, Sparkles, MicOff } from "lucide-react";

const PROVIDERS = {
  openrouter: {
    name: "OpenRouter",
    endpoint: "https://openrouter.ai/api/v1/chat/completions",
    envKey: "REACT_APP_OPENROUTER_API_KEY"
  },
  groq: {
    name: "Groq",
    endpoint: "https://api.groq.com/openai/v1/chat/completions",
    envKey: "REACT_APP_GROQ_API_KEY"
  }
};

const MODELS = [
  { id: "openrouter/free", name: "Auto Free", provider: "openrouter" },
  { id: "meta-llama/llama-3.3-70b-instruct:free", name: "Llama 3.3 70B (Free)", provider: "openrouter" },
  { id: "llama-3.3-70b-versatile", name: "Llama 3.3 70B", provider: "groq" },
  { id: "llama-3.1-8b-instant", name: "Llama 3.1 8B", provider: "groq" }
];

// --- Custom Components ---

// Code Block with Copy Button
const CodeBlock = ({ node, inline, className, children, ...props }) => {
  const [copied, setCopied] = useState(false);
  const match = /language-(\w+)/.exec(className || "");
  const codeString = String(children).replace(/\n$/, "");

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (!inline && match) {
    return (
      <div className="relative group rounded-xl overflow-hidden my-6 border border-white/10 bg-[#0d0d0d] shadow-2xl">
        <div className="flex items-center justify-between px-4 py-2.5 bg-white/5 text-xs text-gray-400 backdrop-blur-md border-b border-white/5">
          <span className="font-mono tracking-wider">{match[1]}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 hover:text-white transition-all duration-300"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
            {copied ? "Copied!" : "Copy code"}
          </button>
        </div>
        <SyntaxHighlighter
          style={atomDark}
          language={match[1]}
          PreTag="div"
          customStyle={{ margin: 0, padding: "1.25rem", backgroundColor: "transparent", fontSize: "0.9rem" }}
          {...props}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    );
  }
  return (
    <code className="bg-white/10 text-indigo-300 px-1.5 py-0.5 rounded-md text-sm border border-white/5" {...props}>
      {children}
    </code>
  );
};

// --- Main App ---

const ChatComponent = () => {
  const [sessions, setSessions] = useState(() => {
    const saved = localStorage.getItem("chatSessions");
    return saved ? JSON.parse(saved) : [{ id: uuidv4(), title: "New Chat", messages: [] }];
  });
  const [activeSessionId, setActiveSessionId] = useState(sessions[0]?.id);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [selectedModel, setSelectedModel] = useState(MODELS[0].id);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  
  const messagesEndRef = useRef(null);
  const textareaRef = useRef(null);
  const recognitionRef = useRef(null);

  const activeSession = sessions.find(s => s.id === activeSessionId) || sessions[0];
  const messages = React.useMemo(() => activeSession?.messages || [], [activeSession?.messages]);

  useEffect(() => {
    if (typeof window !== "undefined" && ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = true;
      recognitionRef.current.interimResults = true;
      
      recognitionRef.current.onresult = (event) => {
        let finalTranscript = '';

        for (let i = event.resultIndex; i < event.results.length; ++i) {
          if (event.results[i].isFinal) {
            finalTranscript += event.results[i][0].transcript;
          }
        }
        
        // Since setInput is async and can cause loops with speech recognition,
        // we use a simplified approach to just append finalized text reliably.
        if (finalTranscript) {
          setInput(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + finalTranscript);
        }
      };

      recognitionRef.current.onerror = (event) => {
        console.error("Speech recognition error:", event.error);
        setIsListening(false);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };
    }
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const playSound = (type) => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      
      if (type === 'start') {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.1);
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.1);
      } else {
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(880, audioCtx.currentTime);
        oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.15);
        gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        gainNode.gain.linearRampToValueAtTime(0.3, audioCtx.currentTime + 0.05);
        gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.15);
        oscillator.start(audioCtx.currentTime);
        oscillator.stop(audioCtx.currentTime + 0.15);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const toggleListening = () => {
    if (isListening) {
      playSound('stop');
      recognitionRef.current?.stop();
      setIsListening(false);
    } else {
      if (!recognitionRef.current) {
        alert("Your browser does not support Speech Recognition. Please try Google Chrome.");
        return;
      }
      try {
        playSound('start');
        recognitionRef.current.start();
        setIsListening(true);
      } catch (e) {
        console.error("Microphone error:", e);
      }
    }
  };

  useEffect(() => {
    localStorage.setItem("chatSessions", JSON.stringify(sessions));
  }, [sessions]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };
  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 200)}px`;
    }
  }, [input]);

  const startNewChat = () => {
    const newSession = { id: uuidv4(), title: "New Chat", messages: [] };
    setSessions([newSession, ...sessions]);
    setActiveSessionId(newSession.id);
    setSidebarOpen(false);
  };

  const deleteSession = (e, id) => {
    e.stopPropagation();
    const updatedSessions = sessions.filter(s => s.id !== id);
    if (updatedSessions.length === 0) {
      const newSession = { id: uuidv4(), title: "New Chat", messages: [] };
      setSessions([newSession]);
      setActiveSessionId(newSession.id);
    } else {
      setSessions(updatedSessions);
      if (activeSessionId === id) setActiveSessionId(updatedSessions[0].id);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleSendMessage = async () => {
    if (!input.trim() || loading) return;

    const modelConfig = MODELS.find(m => m.id === selectedModel) || MODELS[0];
    const provider = PROVIDERS[modelConfig.provider];
    
    const newMessages = [...messages, { role: "user", content: input }];
    
    let newTitle = activeSession.title;
    if (messages.length === 0 && input) {
      newTitle = input.length > 30 ? input.substring(0, 30) + "..." : input;
    }

    const updatedSessions = sessions.map(s => 
      s.id === activeSessionId ? { ...s, messages: newMessages, title: newTitle } : s
    );
    setSessions(updatedSessions);
    setInput("");
    setLoading(true);

    const apiKey = process.env[provider.envKey];

    if (!apiKey) {
      const errorMsg = { role: "assistant", content: `Error: Please set ${provider.envKey} in your .env file and restart.` };
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...newMessages, errorMsg] } : s));
      setLoading(false);
      return;
    }

    try {
      const headers = { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` };
      if (modelConfig.provider === "openrouter") {
        headers["HTTP-Referer"] = window.location.origin;
        headers["X-Title"] = "Nexus AI";
      }

      const response = await axios.post(provider.endpoint, { model: modelConfig.id, messages: newMessages }, { headers });
      const reply = response.data?.choices?.[0]?.message?.content || "No response received.";
      const assistantMsg = { role: "assistant", content: reply };
      
      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...newMessages, assistantMsg] } : s));
    } catch (error) {
      console.error("Error:", error);
      
      // Format human readable error messages
      let errorMsg = error.response?.data?.error?.message || error.message;
      let humanReadableError = errorMsg;
      
      if (error.response?.status === 429 || errorMsg.toLowerCase().includes("rate-limited")) {
        humanReadableError = "⚠️ **High Traffic Warning**: The AI model you selected is currently receiving too many requests and is temporarily rate-limited. Please wait a few moments and try again, or switch to a different model in the dropdown above.";
      } else if (errorMsg.toLowerCase().includes("decommissioned")) {
        humanReadableError = "⚠️ **Model Offline**: This specific AI model has been decommissioned by the provider. Please select a different model from the dropdown above.";
      } else {
        humanReadableError = `**Network Error**: ${errorMsg}`;
      }

      setSessions(prev => prev.map(s => s.id === activeSessionId ? { ...s, messages: [...newMessages, { role: "assistant", content: humanReadableError }] } : s));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-black text-gray-100 font-sans overflow-hidden selection:bg-indigo-500/30">
      
      <div className="absolute inset-0 z-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[-20%] left-[-10%] w-[50vw] h-[50vw] rounded-full bg-indigo-900/20 blur-[150px] mix-blend-screen opacity-50"></div>
        <div className="absolute bottom-[-20%] right-[-10%] w-[50vw] h-[50vw] rounded-full bg-purple-900/20 blur-[150px] mix-blend-screen opacity-50"></div>
      </div>
      
      <div className={`fixed inset-y-0 left-0 z-40 w-72 bg-white/[0.02] backdrop-blur-3xl border-r border-white/5 transform transition-transform duration-500 cubic-bezier(0.16, 1, 0.3, 1) flex flex-col ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} md:relative md:translate-x-0`}>
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2 text-white">
            <Sparkles className="text-indigo-400" size={24} />
            Nexus AI
          </h1>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden text-gray-400 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>
        
        <div className="p-4">
          <button 
            onClick={startNewChat}
            className="flex items-center justify-center gap-2 w-full px-4 py-3 bg-white/10 hover:bg-white/15 border border-white/10 text-white rounded-xl transition-all duration-300 font-medium text-sm hover:scale-[1.02] active:scale-[0.98]"
          >
            <Plus size={18} /> New Chat
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1 scrollbar-thin scrollbar-thumb-white/10">
          <p className="text-xs font-semibold text-gray-500 px-3 pb-3 pt-2 uppercase tracking-widest">History</p>
          {sessions.map(session => (
            <div 
              key={session.id}
              onClick={() => { setActiveSessionId(session.id); setSidebarOpen(false); }}
              className={`flex items-center justify-between group cursor-pointer px-3 py-3 rounded-xl text-sm transition-all duration-300 ${activeSessionId === session.id ? 'bg-white/10 text-white shadow-lg shadow-black/20' : 'text-gray-400 hover:bg-white/5 hover:text-gray-200'}`}
            >
              <div className="flex items-center gap-3 overflow-hidden">
                <MessageSquare size={16} className={`shrink-0 ${activeSessionId === session.id ? 'text-indigo-400' : ''}`} />
                <span className="truncate font-medium">{session.title}</span>
              </div>
              <button 
                onClick={(e) => deleteSession(e, session.id)}
                className="opacity-0 group-hover:opacity-100 text-gray-500 hover:text-red-400 transition-all duration-300 hover:scale-110"
              >
                <Trash2 size={16} />
              </button>
            </div>
          ))}
        </div>
        
        <div className="p-6 border-t border-white/5 bg-gradient-to-t from-black/40 to-transparent">
          <div className="flex flex-col gap-1 items-center justify-center text-center">
            <p className="text-xs text-gray-400">Made by</p>
            <p className="text-sm font-semibold bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 to-purple-400">Boobalan</p>
            <p className="text-[10px] text-gray-500 tracking-widest uppercase">(Software Developer)</p>
          </div>
        </div>
      </div>

      <div className="flex-1 flex flex-col relative w-full h-full overflow-hidden z-10">
        
        {sidebarOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-30 md:hidden transition-opacity duration-300" onClick={() => setSidebarOpen(false)}></div>
        )}

        <header className="flex items-center justify-between px-6 py-4 bg-transparent z-10">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden text-gray-400 hover:text-white p-2 bg-white/5 rounded-xl border border-white/5 transition-all">
              <Menu size={20} />
            </button>
            <h2 className="text-lg font-semibold text-white md:hidden">Nexus AI</h2>
          </div>
          <div className="flex items-center justify-end w-full">
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="bg-white/5 backdrop-blur-md border border-white/10 text-gray-200 text-sm font-medium rounded-xl focus:ring-2 focus:ring-indigo-500/50 outline-none px-4 py-2.5 transition-all hover:bg-white/10 hover:border-white/20 shadow-lg shadow-black/20 appearance-none cursor-pointer pr-10 relative"
              style={{ backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 24 24' stroke='%239CA3AF'%3E%3Cpath stroke-linecap='round' stroke-linejoin='round' stroke-width='2' d='M19 9l-7 7-7-7'%3E%3C/path%3E%3C/svg%3E")`, backgroundPosition: `right 0.75rem center`, backgroundRepeat: `no-repeat`, backgroundSize: `1.2em 1.2em` }}
            >
              {MODELS.map((model) => (
                <option key={model.id} value={model.id} className="bg-[#111] text-white">
                  {model.name}
                </option>
              ))}
            </select>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto px-4 md:px-8 pb-4 scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
          <div className="max-w-3xl mx-auto flex flex-col gap-8 pb-10">
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-[70vh] text-center px-4 animate-fade-in-up">
                <div className="w-20 h-20 bg-white/5 backdrop-blur-xl border border-white/10 rounded-3xl flex items-center justify-center mb-8 shadow-[0_0_50px_rgba(79,70,229,0.15)] ring-1 ring-white/10">
                  <Sparkles size={36} className="text-indigo-400" />
                </div>
                <h2 className="text-3xl font-bold mb-3 tracking-tight text-white">How can I help you today?</h2>
                <p className="text-gray-400 max-w-md leading-relaxed">Select a model from the top right to begin.</p>
              </div>
            ) : (
              messages.map((msg, index) => {
                const isUser = msg.role === "user";
                return (
                  <div key={index} className={`flex ${isUser ? "justify-end" : "justify-start"} animate-fade-in-up group`}>
                    <div className={`max-w-[85%] md:max-w-[80%] p-5 shadow-2xl transition-all duration-300 ${
                      isUser 
                        ? "bg-gradient-to-br from-indigo-600 to-purple-600 text-white rounded-3xl rounded-br-sm shadow-indigo-500/20" 
                        : "bg-white/[0.03] backdrop-blur-xl border border-white/10 text-gray-100 rounded-3xl rounded-bl-sm hover:bg-white/[0.05]"
                    }`}>
                      {isUser ? (
                        <div className="whitespace-pre-wrap leading-relaxed text-[15px] font-medium">{msg.content}</div>
                      ) : (
                        <div className="prose prose-invert prose-p:leading-relaxed prose-pre:p-0 prose-headings:text-white prose-a:text-indigo-400 max-w-none text-[15px]">
                          <ReactMarkdown components={{ code: CodeBlock }}>
                            {msg.content}
                          </ReactMarkdown>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })
            )}
            
            {loading && (
              <div className="flex justify-start animate-fade-in-up">
                <div className="bg-white/5 backdrop-blur-xl border border-white/10 p-5 rounded-3xl rounded-bl-sm flex gap-3 items-center shadow-lg">
                  <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce"></div>
                  <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "0.2s" }}></div>
                  <div className="w-2.5 h-2.5 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: "0.4s" }}></div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>
        </main>

        <div className="px-4 pb-6 pt-2 bg-gradient-to-t from-black via-black to-transparent shrink-0">
          <div className="max-w-3xl mx-auto">
            <div className="relative flex items-end bg-white/5 backdrop-blur-2xl border border-white/10 rounded-[2rem] shadow-2xl focus-within:border-white/30 focus-within:bg-white/10 transition-all duration-300 overflow-hidden px-2 py-2">
              
              <button
                onClick={toggleListening}
                className={`p-3 flex items-center justify-center w-12 h-12 transition-all duration-300 rounded-full mb-0.5 ml-1 shrink-0 ${isListening ? 'bg-red-500/10 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                title={isListening ? "Stop listening" : "Start Voice to Text"}
              >
                {isListening ? (
                  <div className="flex items-center justify-center gap-0.5 h-4">
                    <div className="w-1 bg-red-500 rounded-full animate-wave-1 h-full"></div>
                    <div className="w-1 bg-red-500 rounded-full animate-wave-2 h-full"></div>
                    <div className="w-1 bg-red-500 rounded-full animate-wave-3 h-full"></div>
                  </div>
                ) : (
                  <MicOff size={22} />
                )}
              </button>

              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Message Nexus AI... (Shift+Enter for new line)"
                className="flex-1 max-h-[200px] bg-transparent text-white px-4 py-3 outline-none resize-none scrollbar-thin scrollbar-thumb-white/20 text-[15px] font-medium placeholder:text-gray-500"
                rows={1}
              />
              <button
                onClick={handleSendMessage}
                disabled={loading || !input.trim()}
                className="p-3 text-white bg-indigo-600 hover:bg-indigo-500 disabled:bg-white/5 disabled:text-gray-600 transition-all duration-300 rounded-full mb-0.5 ml-1 mr-1 shrink-0 shadow-lg disabled:shadow-none hover:scale-105 active:scale-95"
              >
                <Send size={20} />
              </button>
            </div>
            
            <div className="text-center mt-4 text-xs font-medium text-gray-500 tracking-wide">
              Powered by advanced AI language models.
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(20px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        @keyframes wave {
          0% { height: 30%; }
          50% { height: 100%; }
          100% { height: 30%; }
        }
        .animate-wave-1 { animation: wave 0.8s ease-in-out infinite; }
        .animate-wave-2 { animation: wave 0.8s ease-in-out infinite 0.2s; }
        .animate-wave-3 { animation: wave 0.8s ease-in-out infinite 0.4s; }
        .animate-fade-in-up { animation: fadeInUp 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        .scrollbar-thin::-webkit-scrollbar { width: 6px; }
        .scrollbar-thin::-webkit-scrollbar-track { background: transparent; }
        .scrollbar-thin::-webkit-scrollbar-thumb { background-color: rgba(255,255,255,0.1); border-radius: 20px; }
        .scrollbar-thin::-webkit-scrollbar-thumb:hover { background-color: rgba(255,255,255,0.2); }
      `}</style>
    </div>
  );
};

export default ChatComponent;


