import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Send, Activity, Heart, User, Sparkles, Database } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

/**
 * Root React component for the Reflecta chat user interface.
 *
 * Manages chat messages, user input, loading state, and persona status; communicates with the backend chat and reflection endpoints to send messages, receive assistant responses, and refresh persona status; and renders the sidebar status panel, scrollable chat area, and input controls with animated message transitions.
 *
 * @returns The JSX element for the main application UI
 */
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

  const scrollRef = useRef<HTMLDivElement>(null);

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
      setStatus(res.data.status);
    } catch (error) {
      console.error('Error sending message:', error);
      setMessages(prev => [...prev, { role: 'assistant', content: 'エラーが発生しました。' }]);// todo ここでエラーになってしまう
    } finally {
      setIsLoading(false);
    }
  };

  const handleReflect = async () => {
    setIsLoading(true);
    try {
      const res = await axios.post(`${API_URL}/api/reflect`);
      alert(`内省完了: ${res.data.reflection.permanentMemory}`);
      // Refresh status
      const resChat = await axios.post(`${API_URL}/api/chat`, { message: "内省が終わったようですね。今の気分はどうですか？" });
      setMessages(prev => [...prev, { role: 'assistant', content: resChat.data.response }]);
      setStatus(resChat.data.status);
    } catch (error) {
      console.error('Reflection error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen bg-slate-950 text-slate-100 overflow-hidden">
      {/* Sidebar: Persona Status */}
      <aside className="w-80 glass p-6 flex flex-col gap-8 border-r border-white/5">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-sky-500/20 rounded-lg">
            <User className="text-sky-400" size={24} />
          </div>
          <h1 className="text-2xl font-bold tracking-tight glow-text">Reflecta</h1>
        </div>

        <section className="space-y-6">
          <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Activity size={16} /> Persona Status
          </h2>

          <div className="space-y-4">
            <StatusItem label="Health" value={status.health} icon={<Heart size={16} className="text-rose-500" />} />
            <StatusItem label="Emotion" value={status.mood} icon={<Sparkles size={16} className="text-amber-500" />} />
            <StatusItem label="Trust" value={status.trust} icon={<Database size={16} className="text-emerald-500" />} />
          </div>

          <div className="p-4 bg-white/5 rounded-xl space-y-2 border border-white/5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Height</span>
              <span className="font-mono text-sky-400">{status.height.toFixed(1)} cm</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Weight</span>
              <span className="font-mono text-sky-400">{status.weight.toFixed(1)} kg</span>
            </div>
          </div>

          <button
            onClick={handleReflect}
            disabled={isLoading}
            className="w-full py-4 glass hover:bg-white/10 rounded-xl flex items-center justify-center gap-2 border border-white/10 transition-all active:scale-95 disabled:opacity-50"
          >
            <Sparkles size={18} className="text-sky-400" />
            <span className="text-sm font-bold uppercase tracking-wider">Self Reflect</span>
          </button>
        </section>
      </aside>

      {/* Main Chat Area */}
      <main className="flex-1 flex flex-col relative">
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-8 space-y-6 scroll-smooth"
        >
          <AnimatePresence initial={false}>
            {messages.length === 0 && (
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="h-full flex flex-col items-center justify-center text-slate-500 space-y-4"
              >
                <Database size={48} className="opacity-20" />
                <p className="text-lg">対話を開始して、Reflectaの意識を呼び覚ましてください</p>
              </motion.div>
            )}
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: m.role === 'user' ? 20 : -20 }}
                animate={{ opacity: 1, x: 0 }}
                className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div className={`max-w-[70%] p-4 rounded-2xl ${m.role === 'user'
                  ? 'bg-sky-600 text-white shadow-lg'
                  : 'glass shadow-xl'
                  }`}>
                  <p className="leading-relaxed">{m.content}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
          {isLoading && (
            <div className="flex justify-start">
              <div className="glass p-4 rounded-2xl flex gap-2">
                <span className="w-2 h-2 bg-sky-500 rounded-full animate-bounce" />
                <span className="w-2 h-2 bg-sky-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                <span className="w-2 h-2 bg-sky-500 rounded-full animate-bounce [animation-delay:0.4s]" />
              </div>
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="p-8 pt-0">
          <div className="max-w-4xl mx-auto flex gap-4 p-2 glass rounded-2xl border border-white/10 shadow-2xl focus-within:ring-2 focus-within:ring-sky-500/50 transition-all">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSend()}
              placeholder="何でも話しかけてください..."
              className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-white placeholder-slate-500"
            />
            <button
              onClick={handleSend}
              disabled={isLoading}
              className="p-3 bg-sky-500 hover:bg-sky-400 disabled:bg-slate-700 rounded-xl transition-colors shadow-lg shadow-sky-500/20"
            >
              <Send size={20} />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusItem({ label, value, icon }: { label: string, value: number, icon: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="flex justify-between items-center text-xs">
        <div className="flex items-center gap-2">
          {icon}
          <span className="text-slate-300 uppercase tracking-tighter font-bold">{label}</span>
        </div>
        <span className="font-mono text-sky-400">{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          className={`h-full ${label === 'Health' ? 'bg-rose-500' : label === 'Emotion' ? 'bg-amber-500' : 'bg-emerald-500'}`}
        />
      </div>
    </div>
  );
}

export default App;