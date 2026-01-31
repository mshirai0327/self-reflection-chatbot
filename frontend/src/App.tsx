import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Menu, ChevronLeft, Database, Sun, Moon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { BotSidebar } from './components/BotSidebar';
import { ChatHistory } from './components/ChatHistory';
import { handleApiError } from './utils/errorHandler';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

interface PersonaStatus {
  // Lv1 & Lv2 (Immutable/Semi-immutable)
  name?: string;
  birthDate?: string;
  gender?: string;
  bloodType?: string;
  chronotype?: string;
  intelligence?: number;
  ethics?: number;
  passion?: number;
  curiosity?: number;
  aggressiveness?: number;
  extroversion?: number;

  // Physical (Variable)
  height: number;
  weight: number;
  boneDensity?: number;
  bloodSugar?: number;
  bloodPressureSys?: number;
  bloodPressureDia?: number;
  sleepTime?: number;
  sleepQuality?: number;

  // Status (Volatile)
  health: number;
  mood: number;
  trust: number;
  friendliness?: number;
}

export interface DebugInfo {
  systemPrompt: string;
  userPrompt: string;
  contextMemories: string[];
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
  const [lastDebugInfo, setLastDebugInfo] = useState<DebugInfo | null>(null);
  const [lastReflection, setLastReflection] = useState<any | null>(null);

  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [chatModel, setChatModel] = useState<string>(() => localStorage.getItem('chatModel') || 'gemini-2.5-flash');
  const [reflectModel, setReflectModel] = useState<string>(() => localStorage.getItem('reflectModel') || 'gemini-2.5-pro');
  const [llmSettings, setLlmSettings] = useState(() => {
    const saved = localStorage.getItem('llmSettings');
    const defaultSettings = {
      provider: 'gemini' as 'gemini' | 'local',
      localEndpoint: 'http://localhost:11434/v1',
      localModel: 'llama3',
      availableModels: [] as string[]
    };
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch (e) {
        console.error('Failed to parse llmSettings from localStorage', e);
        localStorage.removeItem('llmSettings');
        return defaultSettings;
      }
    }
    return defaultSettings;
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);

  // 設定の永続化
  useEffect(() => {
    localStorage.setItem('chatModel', chatModel);
  }, [chatModel]);

  useEffect(() => {
    localStorage.setItem('reflectModel', reflectModel);
  }, [reflectModel]);

  useEffect(() => {
    localStorage.setItem('llmSettings', JSON.stringify(llmSettings));
  }, [llmSettings]);

  // ダークモードのクラス切り替え
  useEffect(() => {
    console.log('Dark mode changed:', isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // 初回読み込み時に最新のチャットを自動選択
  useEffect(() => {
    const fetchInitialChat = async () => {
      try {
        console.log('[App] Fetching initial chats from:', `${API_URL}/api/chats`);
        const res = await axios.get(`${API_URL}/api/chats`);
        console.log('[App] Chats received:', res.data);
        if (res.data && res.data.length > 0) {
          const latestChatId = res.data[0].id;
          console.log('[App] Automatically selecting latest chat:', latestChatId);
          setCurrentChatId(latestChatId);
        } else {
          console.log('[App] No existing chats found.');
        }
      } catch (error) {
        console.error('[App] Failed to fetch initial chats:', error);
      }
    };
    fetchInitialChat();
  }, []);

  useEffect(() => {
    const fetchChatSession = async () => {
      if (!currentChatId) {
        console.log('[App] No currentChatId, clearing messages.');
        setMessages([]);
        return;
      }
      try {
        console.log('[App] Fetching logs for chat:', currentChatId);
        const res = await axios.get(`${API_URL}/api/chats/${currentChatId}`);
        const history = res.data.chatLogs.map((log: any) => ({
          role: log.role as 'user' | 'assistant',
          content: log.content
        }));
        setMessages(history);

        // 内省結果があればセット
        if (res.data.latestReflection) {
          console.log('[App] Found previous reflection:', res.data.latestReflection);
          setLastReflection(res.data.latestReflection);
        } else {
          setLastReflection(null);
        }
      } catch (error) {
        console.error('[App] Failed to fetch chat logs:', error);
      }
    };
    fetchChatSession();
  }, [currentChatId]);

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
      const llmConfig = {
        provider: llmSettings.provider,
        model: llmSettings.provider === 'local' ? llmSettings.localModel : chatModel,
        endpoint: llmSettings.provider === 'local' ? llmSettings.localEndpoint : undefined
      };

      const res = await axios.post(`${API_URL}/api/chat`, {
        message: input,
        llmConfig,
        chatId: currentChatId
      });

      // 新規チャット作成時の処理
      if (!currentChatId && res.data.chatId) {
        setCurrentChatId(res.data.chatId);
      }
      const aiMsg: Message = { role: 'assistant', content: res.data.response };
      setMessages(prev => [...prev, aiMsg]);
      if (res.data.status) setStatus(res.data.status);
      if (res.data.debug) setLastDebugInfo(res.data.debug);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      handleApiError(error, 'メッセージの送信に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReflect = async () => {
    setIsLoading(true);
    try {
      const llmConfig = {
        provider: llmSettings.provider,
        model: llmSettings.provider === 'local' ? llmSettings.localModel : reflectModel,
        endpoint: llmSettings.provider === 'local' ? llmSettings.localEndpoint : undefined
      };

      const res = await axios.post(`${API_URL}/api/reflect`, { llmConfig });
      toast.success(`内省完了: ${res.data.reflection.permanentMemory || "新たな気付きはありませんでした"}`, {
        duration: 5000,
        style: {
          background: '#10B981', // Emerald 500
          color: '#fff',
        },
        iconTheme: {
          primary: '#fff',
          secondary: '#10B981',
        },
      });
      setLastReflection(res.data.reflection);

      const followUpMessage = "内省が終わったようですね。今の気分はどうですか？";
      setMessages(prev => [...prev, { role: 'user', content: followUpMessage }]);

      const resChat = await axios.post(`${API_URL}/api/chat`, {
        message: followUpMessage,
        llmConfig,
        chatId: currentChatId
      });
      setMessages(prev => [...prev, { role: 'assistant', content: resChat.data.response }]);
      if (resChat.data.status) setStatus(resChat.data.status);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      handleApiError(error, '内省処理に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-300">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          error: {
            duration: 4000,
          },
        }}
      />

      {/* Fixed Header */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-40 transition-colors duration-300 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLeftOpen(!isLeftOpen)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title={isLeftOpen ? "サイドバーを閉じる" : "サイドバーを開く"}
          >
            <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
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
          <button
            onClick={() => setIsRightOpen(!isRightOpen)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title={isRightOpen ? "チャットログを閉じる" : "チャットログを開く"}
          >
            <ChevronLeft className={`w-5 h-5 text-slate-600 dark:text-slate-400 transition-transform duration-300 ${isRightOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Bot Sidebar (Left) */}
        <BotSidebar
          isOpen={isLeftOpen}
          status={status}
          lastDebugInfo={lastDebugInfo}
        />

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col relative bg-slate-50 dark:bg-slate-950 min-w-0">

          {/* Messages */}
          <div
            ref={scrollRef}
            className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth scrollbar-hide"
          >
            <div className="w-full max-w-[740px] mx-auto space-y-6">
              <AnimatePresence initial={false}>
                {messages.length === 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 space-y-4 py-20"
                  >
                    <Database size={48} className="opacity-10" />
                    <p className="text-lg text-slate-500">対話を開始して、意識を呼び覚ましてください</p>
                  </motion.div>
                )}
                {messages.map((m, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: 0, y: 10 }}
                    animate={{ opacity: 1, x: 0, y: 0 }}
                    className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-[85%] p-4 rounded-2xl shadow-sm transition-colors duration-300 ${m.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-none'
                      : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 dark:text-slate-100 rounded-bl-none'
                      }`}>
                      <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {isLoading && (
                <div className="flex justify-start">
                  <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl rounded-bl-none flex gap-2">
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                    <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Input Area */}
          <div className="p-4 pt-0 z-10">
            <div className="w-full max-w-[740px] mx-auto">
              <div className="flex gap-3 p-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl focus-within:ring-2 focus-within:ring-blue-500/20 transition-all">
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
              <div className="text-center mt-4 mb-2">
                <button
                  onClick={handleReflect}
                  disabled={isLoading}
                  className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-full shadow-md hover:shadow-lg transition-all duration-300 text-xs font-semibold tracking-wide cursor-pointer disabled:cursor-not-allowed"
                >
                  内省を実行する
                </button>
              </div>
            </div>
          </div>
        </main>

        {/* Chat History Sidebar (Right) */}
        <ChatHistory
          isOpen={isRightOpen}
          refreshTrigger={refreshTrigger}
          onSelectChat={(id: string) => setCurrentChatId(id)}
          currentChatId={currentChatId}
          onNewChat={() => setCurrentChatId(null)}
          chatModel={chatModel}
          setChatModel={setChatModel}
          reflectModel={reflectModel}
          setReflectModel={setReflectModel}
          llmSettings={llmSettings}
          setLlmSettings={setLlmSettings}
          lastReflection={lastReflection}
        />
      </div>
    </div>
  );
}

export default App;