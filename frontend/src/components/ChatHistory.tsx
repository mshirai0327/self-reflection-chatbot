import { useEffect, useState } from 'react';
import axios from 'axios';
import { MessageCircle, PlusCircle, Settings, CheckCircle, RefreshCw, ChevronDown, ChevronRight, Brain } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

interface Chat {
    id: string;
    title: string;
    updatedAt: string;
    _count?: {
        chatLogs: number;
    };
}

interface ReflectionResult {
    thought: string;
    statusUpdate: {
        health: number;
        mood: number;
        trust: number;
        friendliness: number;
    };
    permanentMemory?: string;
    prompt?: string;
}

type ChatHistoryProps = {
    isOpen: boolean;
    refreshTrigger: number;
    onSelectChat: (id: string) => void;
    currentChatId: string | null;
    onNewChat: () => void;
    // LLM Settings
    chatModel: string;
    setChatModel: (model: string) => void;
    reflectModel: string;
    setReflectModel: (model: string) => void;
    llmSettings: {
        provider: 'gemini' | 'local';
        localEndpoint: string;
        localModel: string;
        availableModels: string[];
    };
    setLlmSettings: React.Dispatch<React.SetStateAction<{
        provider: 'gemini' | 'local';
        localEndpoint: string;
        localModel: string;
        availableModels: string[];
    }>>;
    lastReflection: ReflectionResult | null;
};

const API_URL = import.meta.env.VITE_API_URL || '';

// Models List (Duplicated from BotSidebar, kept in sync by convention or ideally shared const)
const MODELS = [
    { value: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
    { value: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
    { value: 'gemini-2.5-flash-lite', label: 'Gemini 2.5 Flash-Lite' },
    { value: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    { value: 'gemini-2.0-flash-lite', label: 'Gemini 2.0 Flash-Lite' },
    { value: 'gemini-pro-latest', label: 'Gemini Pro Latest' },
    { value: 'gemini-flash-latest', label: 'Gemini Flash Latest' },
    { value: 'gemini-3-pro-preview', label: 'Gemini 3 Pro Preview' },
    { value: 'gemini-3-flash-preview', label: 'Gemini 3 Flash Preview' },
    { value: 'gemma-3-27b-it', label: 'Gemma 3 27B' },
    { value: 'gemma-3-12b-it', label: 'Gemma 3 12B' },
    { value: 'gemma-3-4b-it', label: 'Gemma 3 4B' },
    { value: 'gemma-3-1b-it', label: 'Gemma 3 1B' },
];

export function ChatHistory({
    isOpen,
    refreshTrigger,
    onSelectChat,
    currentChatId,
    onNewChat,
    chatModel,
    setChatModel,
    reflectModel,
    setReflectModel,
    llmSettings,
    setLlmSettings,
    lastReflection
}: ChatHistoryProps) {
    const [chats, setChats] = useState<Chat[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [isReflectionOpen, setIsReflectionOpen] = useState(true);

    useEffect(() => {
        const fetchChats = async () => {
            setIsLoading(true);
            try {
                const res = await axios.get(`${API_URL}/api/chats`);
                setChats(res.data);
            } catch (error) {
                console.error('[ChatHistory] Failed to fetch chats:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchChats();
    }, [refreshTrigger, currentChatId]);

    // Automatically open reflection accordion when a new reflection arrives
    useEffect(() => {
        if (lastReflection) {
            setIsReflectionOpen(true);
        }
    }, [lastReflection]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();

        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
        }
    };

    const testConnection = async () => {
        const loadingToast = toast.loading('接続を確認中...');
        try {
            const res = await axios.post(`${API_URL}/api/llm/test`, {
                endpoint: llmSettings.localEndpoint
            });
            if (res.data.success) {
                toast.success('接続に成功しました！', { id: loadingToast });
            } else {
                toast.error('接続に失敗しました。URLを確認してください。', { id: loadingToast });
            }
        } catch (error: any) {
            console.error('Connection test failed:', error);
            toast.error('疎通エラー: サーバーに到達できませんでした。', { id: loadingToast });
        }
    };

    const fetchModels = async () => {
        const loadingToast = toast.loading('モデル一覧を取得中...');
        try {
            const res = await axios.post(`${API_URL}/api/llm/models`, {
                endpoint: llmSettings.localEndpoint
            });
            const models = res.data.models;
            if (models && models.length > 0) {
                setLlmSettings(prev => ({
                    ...prev,
                    availableModels: models,
                    localModel: models[0] // 最初のモデルをデフォルトに設定
                }));
                toast.success(`${models.length} 個のモデルを取得しました`, { id: loadingToast });
            } else {
                toast.error('モデルが見つかりませんでした', { id: loadingToast });
            }
        } catch (error: any) {
            console.error('Failed to fetch models:', error);
            toast.error('モデルの取得に失敗しました。エンドポイントを確認してください。', { id: loadingToast });
        }
    };

    return (
        <div className={`bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 transition-all duration-300 flex-shrink-0 ${isOpen ? 'w-80' : 'w-0'
            } overflow-hidden flex flex-col shadow-lg`}>
            <div className="w-80 h-full flex flex-col">
                {/* ヘッダー */}
                <div className="border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                    <h2 className="font-semibold text-slate-900 dark:text-slate-100 flex items-center gap-2">
                        <MessageCircle className="w-4 h-4" />
                        Chat History
                    </h2>
                    <button
                        onClick={onNewChat}
                        className="p-1.5 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors text-blue-600 dark:text-blue-400 border border-transparent hover:border-blue-200 dark:hover:border-slate-600"
                        title="New Chat"
                    >
                        <PlusCircle className="w-5 h-5" />
                    </button>
                </div>

                {/* チャットログリスト (Scrollable) */}
                <div className="flex-1 overflow-y-auto min-h-0">
                    {isLoading && chats.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-sm">Loading...</div>
                    ) : chats.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">No history</div>
                    ) : (
                        chats.map((chat) => (
                            <div
                                key={chat.id}
                                onClick={() => onSelectChat(chat.id)}
                                className={`p-3 border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group ${currentChatId === chat.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : ''
                                    }`}
                            >
                                <div className="flex items-start justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <MessageCircle className={`w-3.5 h-3.5 transition-colors flex-shrink-0 ${currentChatId === chat.id ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'
                                            }`} />
                                        <h3 className={`font-medium text-xs truncate max-w-[180px] ${currentChatId === chat.id ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-slate-200'
                                            }`}>{chat.title}</h3>
                                    </div>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                        {formatDate(chat.updatedAt)}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Reflection Result Accordion (Moved to bottom) */}
                <AnimatePresence>
                    {lastReflection && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/80"
                        >
                            <button
                                onClick={() => setIsReflectionOpen(!isReflectionOpen)}
                                className="w-full flex items-center justify-between p-3 text-xs font-semibold text-indigo-700 dark:text-indigo-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
                            >
                                <div className="flex items-center gap-2">
                                    <Brain className="w-4 h-4" />
                                    Latest Reflection
                                </div>
                                {isReflectionOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                            </button>
                            {isReflectionOpen && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 1 }}
                                    className="p-3 pt-0 text-xs space-y-3 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700"
                                >
                                    <div>
                                        <span className="text-slate-400 block mb-1">Status Update</span>
                                        <div className="grid grid-cols-4 gap-1 text-center font-mono">
                                            <div className="bg-white dark:bg-slate-800 p-1 rounded border border-slate-200 dark:border-slate-700">
                                                <span className="block text-[10px] text-slate-400">Health</span>
                                                <span className={lastReflection.statusUpdate.health > 0 ? 'text-green-500' : lastReflection.statusUpdate.health < 0 ? 'text-red-500' : 'text-slate-500'}>
                                                    {lastReflection.statusUpdate.health > 0 ? '+' : ''}{lastReflection.statusUpdate.health}
                                                </span>
                                            </div>
                                            <div className="bg-white dark:bg-slate-800 p-1 rounded border border-slate-200 dark:border-slate-700">
                                                <span className="block text-[10px] text-slate-400">Mood</span>
                                                <span className={lastReflection.statusUpdate.mood > 0 ? 'text-green-500' : lastReflection.statusUpdate.mood < 0 ? 'text-red-500' : 'text-slate-500'}>
                                                    {lastReflection.statusUpdate.mood > 0 ? '+' : ''}{lastReflection.statusUpdate.mood}
                                                </span>
                                            </div>
                                            <div className="bg-white dark:bg-slate-800 p-1 rounded border border-slate-200 dark:border-slate-700">
                                                <span className="block text-[10px] text-slate-400">Trust</span>
                                                <span className={lastReflection.statusUpdate.trust > 0 ? 'text-green-500' : lastReflection.statusUpdate.trust < 0 ? 'text-red-500' : 'text-slate-500'}>
                                                    {lastReflection.statusUpdate.trust > 0 ? '+' : ''}{lastReflection.statusUpdate.trust}
                                                </span>
                                            </div>
                                            <div className="bg-white dark:bg-slate-800 p-1 rounded border border-slate-200 dark:border-slate-700">
                                                <span className="block text-[10px] text-slate-400">Like</span>
                                                <span className={lastReflection.statusUpdate.friendliness > 0 ? 'text-green-500' : lastReflection.statusUpdate.friendliness < 0 ? 'text-red-500' : 'text-slate-500'}>
                                                    {lastReflection.statusUpdate.friendliness > 0 ? '+' : ''}{lastReflection.statusUpdate.friendliness}
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block mb-1">Thought</span>
                                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                                            {lastReflection.thought}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block mb-1">New Memory</span>
                                        {lastReflection.permanentMemory ? (
                                            <p className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-100 dark:border-amber-900/50">
                                                {lastReflection.permanentMemory}
                                            </p>
                                        ) : (
                                            <p className="text-slate-400 dark:text-slate-600 text-xs italic pl-1">
                                                新しい気付きはありませんでした
                                            </p>
                                        )}
                                    </div>
                                    {lastReflection.prompt && (
                                        <div>
                                            <span className="text-slate-400 block mb-1">System Prompt (Reflection)</span>
                                            <div className="bg-slate-900 text-slate-300 p-2 rounded text-[10px] font-mono whitespace-pre-wrap border border-slate-800">
                                                {lastReflection.prompt}
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* API Settings Footer */}
                <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900 flex-shrink-0">
                    <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                        <Settings className="w-3 h-3" /> API Config
                    </h3>
                    <div className="space-y-3">
                        {/* Provider Toggle */}
                        <div className="flex bg-slate-200 dark:bg-slate-800 rounded-lg p-0.5">
                            <button
                                onClick={() => setLlmSettings(prev => ({ ...prev, provider: 'gemini' }))}
                                className={`flex-1 text-[10px] py-1.5 rounded-md transition-all ${llmSettings.provider === 'gemini'
                                    ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400 font-bold'
                                    : 'text-slate-500'
                                    }`}
                            >
                                Gemini
                            </button>
                            <button
                                onClick={() => setLlmSettings(prev => ({ ...prev, provider: 'local' }))}
                                className={`flex-1 text-[10px] py-1.5 rounded-md transition-all ${llmSettings.provider === 'local'
                                    ? 'bg-white dark:bg-slate-700 shadow-sm text-blue-600 dark:text-blue-400 font-bold'
                                    : 'text-slate-500'
                                    }`}
                            >
                                Local (OpenAI互換)
                            </button>
                        </div>

                        {llmSettings.provider === 'gemini' ? (
                            <div className="space-y-2">
                                <div>
                                    <label className="text-[10px] text-slate-500 block mb-1">Chat</label>
                                    <select value={chatModel} onChange={(e) => setChatModel(e.target.value)} className="w-full text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded p-1.5 text-slate-700 dark:text-slate-300">
                                        {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 block mb-1">Reflect</label>
                                    <select value={reflectModel} onChange={(e) => setReflectModel(e.target.value)} className="w-full text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded p-1.5 text-slate-700 dark:text-slate-300">
                                        {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                    </select>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-2">
                                <div className="flex gap-2">
                                    <input
                                        value={llmSettings.localEndpoint}
                                        onChange={(e) => setLlmSettings(p => ({ ...p, localEndpoint: e.target.value }))}
                                        className="flex-1 text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded p-1.5 text-slate-700 dark:text-slate-300"
                                        placeholder="Endpoint"
                                    />
                                    <button onClick={testConnection} className="p-1.5 bg-emerald-100 text-emerald-600 rounded" title="Test"><CheckCircle size={14} /></button>
                                    <button onClick={fetchModels} className="p-1.5 bg-blue-100 text-blue-600 rounded" title="Fetch"><RefreshCw size={14} /></button>
                                </div>
                                <select value={llmSettings.localModel} onChange={(e) => setLlmSettings(p => ({ ...p, localModel: e.target.value }))} className="w-full text-xs bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded p-1.5 text-slate-700 dark:text-slate-300">
                                    {llmSettings.availableModels.length ? llmSettings.availableModels.map(m => <option key={m} value={m}>{m}</option>) : <option>{llmSettings.localModel}</option>}
                                </select>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
