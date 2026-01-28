import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Menu, ChevronLeft, Database, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Toaster } from 'react-hot-toast';
import { BotSidebar } from './components/BotSidebar';
import { ChatHistory } from './components/ChatHistory';
import { handleApiError } from './utils/errorHandler';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PersonaStatus {
  height: number;
  weight: number;
  health: number;
  mood: number;
  trust: number;
}

const API_URL = import.meta.env.VITE_API_URL || '';

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [status, setStatus] = useState<PersonaStatus>({
    height: 160,
    weight: 50,
    health: 100,
    mood: 50,
    trust: 50
  });

  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);

  const scrollRef = useRef<HTMLDivElement>(null);

  // ダークモードのクラス切り替え
  useEffect(() => {
    console.log('Dark mode changed:', isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
      console.log('Added dark class to html. Current classes:', document.documentElement.className);
    } else {
      document.documentElement.classList.remove('dark');
      console.log('Removed dark class from html. Current classes:', document.documentElement.className);
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: input };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    try {
      const res = await axios.post(`${API_URL}/api/chat`, { message: input });
      const aiMsg: Message = { role: 'assistant', content: res.data.response };
      setMessages(prev => [...prev, aiMsg]);
      if (res.data.status) setStatus(res.data.status);
    } catch (error) {
      handleApiError(error, 'メッセージの送信に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReflect = async () => {
    setIsLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/reflect`);
      alert(`内省完了: ${res.data.reflection.permanentMemory}`);
      const resChat = await axios.post(`${API_URL}/api/chat`, { message: "内省が終わったようですね。今の気分はどうですか？" });
      setMessages(prev => [...prev, { role: 'assistant', content: resChat.data.response }]);
      if (resChat.data.status) setStatus(resChat.data.status);
    } catch (error) {
      handleApiError(error, '内省処理に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-300">
      <Toaster position="top-center" />
      {/* Bot Sidebar (Left) */}
      <BotSidebar isOpen={isLeftOpen} onToggle={() => setIsLeftOpen(false)} status={status} />

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative bg-slate-50 dark:bg-slate-950">
        {/* Top Navigation / Sticky Header */}
        <header className="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-10 transition-colors duration-300">
          <div className="flex items-center gap-2">
            {!isLeftOpen && (
              <button
                onClick={() => setIsLeftOpen(true)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="サイドバーを開く"
              >
                <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            )}
            <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 ml-2">Reflecta Chat</h1>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              title={isDarkMode ? "ライトモードに切り替え" : "ダークモードに切り替え"}
            >
              {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
            </button>
            {!isRightOpen && (
              <button
                onClick={() => setIsRightOpen(true)}
                className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                title="チャットログを開く"
              >
                <ChevronLeft className="w-5 h-5 text-slate-600 dark:text-slate-400" />
              </button>
            )}
          </div>
        </header>

        {/* Messages */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 md:p-8 space-y-6 scroll-smooth"
        >
          <AnimatePresence initial={false}>
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 space-y-4"
              >
                <Database size={48} className="opacity-10" />
                <p className="text-lg text-slate-500">対話を開始して、意識を呼び覚ましてください</p>
              </motion.div>
            )}
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: m.role === 'user' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[85%] md:max-w-[70%] p-4 rounded-2xl shadow-sm transition-colors duration-300 ${m.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 dark:text-slate-100'
                  }`}>
                  <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isLoading && (
            <div className="flex justify-start">
              <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl flex gap-2">
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-4 md:p-8 pt-0">
          <div className="max-w-4xl mx-auto flex gap-3 p-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="何でも話しかけてください..."
              className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-400"
            />
            <button
              onClick={handleSend}
              disabled={isLoading}
              className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 rounded-xl transition-colors shadow-lg shadow-blue-500/20 text-white"
            >
              <Send size={20} />
            </button>
          </div>
          <div className="text-center mt-4">
            <button
              onClick={handleReflect}
              disabled={isLoading}
              className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-full shadow-md hover:shadow-lg transition-all duration-300 text-xs font-semibold tracking-wide cursor-pointer disabled:cursor-not-allowed"
            >
              内省を実行する
            </button>
          </div>
        </div>
      </main>

      {/* Chat History Sidebar (Right) */}
      <ChatHistory isOpen={isRightOpen} onToggle={() => setIsRightOpen(false)} />
    </div>
  );
}

export default App;