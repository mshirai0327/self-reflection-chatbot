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

interface ReflectionResponse {
    thought: string;
    statusUpdate: {
        health: number;
        mood: number;
        trust: number;
        friendliness: number;
    };
    permanentMemory?: string;
    newMemories?: string[];
}

interface ReflectionResult {
    id: string;
    prompt?: string;
    createdAt?: string;
    response: ReflectionResponse;
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
        localChatModel: string;
        localReflectModel: string;
        availableModels: string[];
    };
    setLlmSettings: React.Dispatch<React.SetStateAction<{
        provider: 'gemini' | 'local';
        localEndpoint: string;
        localChatModel: string;
        localReflectModel: string;
        availableModels: string[];
    }>>;
    lastReflection: ReflectionResult | null;
};

const API_URL = import.meta.env.VITE_API_URL || '';

// Models List
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
    const [showApiConfig, setShowApiConfig] = useState(false);
    const [loadingModels, setLoadingModels] = useState(false);

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
        } catch (error) {
            console.error('Connection test failed:', error);
            toast.error('疎通エラー: サーバーに到達できませんでした。', { id: loadingToast });
        }
    };

    const fetchModels = async () => {
        setLoadingModels(true);
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
                    localChatModel: models[0],
                    localReflectModel: models[0]
                }));
                toast.success(`${models.length} 個のモデルを取得しました`, { id: loadingToast });
            } else {
                toast.error('モデルが見つかりませんでした', { id: loadingToast });
            }
        } catch (error) {
            console.error('Failed to fetch models:', error);
            toast.error('モデルの取得に失敗しました。エンドポイントを確認してください。', { id: loadingToast });
        } finally {
            setLoadingModels(false);
        }
    };

    return (
        <div className={`bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 transition-all duration-300 flex-shrink-0 ${isOpen ? 'w-80' : 'w-0'} overflow-hidden flex flex-col shadow-lg`}>
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

                {/* チャットログリスト */}
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
                                className={`p-3 border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group ${currentChatId === chat.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : ''}`}
                            >
                                <div className="flex items-start justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <MessageCircle className={`w-3.5 h-3.5 transition-colors flex-shrink-0 ${currentChatId === chat.id ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'}`} />
                                        <h3 className={`font-medium text-xs truncate max-w-[180px] ${currentChatId === chat.id ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-slate-200'}`}>{chat.title}</h3>
                                    </div>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                        {formatDate(chat.updatedAt)}
                                    </span>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Reflection Result Accordion */}
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
                                        {lastReflection.response && lastReflection.response.statusUpdate ? (
                                            <div className="grid grid-cols-4 gap-1 text-center font-mono">
                                                <div className="bg-white dark:bg-slate-800 p-1 rounded border border-slate-200 dark:border-slate-700">
                                                    <span className="block text-[10px] text-slate-400">Health</span>
                                                    <span className={lastReflection.response.statusUpdate.health > 0 ? 'text-green-500' : lastReflection.response.statusUpdate.health < 0 ? 'text-red-500' : 'text-slate-500'}>
                                                        {lastReflection.response.statusUpdate.health > 0 ? '+' : ''}{lastReflection.response.statusUpdate.health}
                                                    </span>
                                                </div>
                                                <div className="bg-white dark:bg-slate-800 p-1 rounded border border-slate-200 dark:border-slate-700">
                                                    <span className="block text-[10px] text-slate-400">Mood</span>
                                                    <span className={lastReflection.response.statusUpdate.mood > 0 ? 'text-green-500' : lastReflection.response.statusUpdate.mood < 0 ? 'text-red-500' : 'text-slate-500'}>
                                                        {lastReflection.response.statusUpdate.mood > 0 ? '+' : ''}{lastReflection.response.statusUpdate.mood}
                                                    </span>
                                                </div>
                                                <div className="bg-white dark:bg-slate-800 p-1 rounded border border-slate-200 dark:border-slate-700">
                                                    <span className="block text-[10px] text-slate-400">Trust</span>
                                                    <span className={lastReflection.response.statusUpdate.trust > 0 ? 'text-green-500' : lastReflection.response.statusUpdate.trust < 0 ? 'text-red-500' : 'text-slate-500'}>
                                                        {lastReflection.response.statusUpdate.trust > 0 ? '+' : ''}{lastReflection.response.statusUpdate.trust}
                                                    </span>
                                                </div>
                                                <div className="bg-white dark:bg-slate-800 p-1 rounded border border-slate-200 dark:border-slate-700">
                                                    <span className="block text-[10px] text-slate-400">Like</span>
                                                    <span className={lastReflection.response.statusUpdate.friendliness > 0 ? 'text-green-500' : lastReflection.response.statusUpdate.friendliness < 0 ? 'text-red-500' : 'text-slate-500'}>
                                                        {lastReflection.response.statusUpdate.friendliness > 0 ? '+' : ''}{lastReflection.response.statusUpdate.friendliness}
                                                    </span>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="text-xs text-slate-500 italic">No status update data</div>
                                        )}
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block mb-1">Thought</span>
                                        <p className="text-slate-600 dark:text-slate-300 leading-relaxed bg-white dark:bg-slate-800 p-2 rounded border border-slate-100 dark:border-slate-700">
                                            {lastReflection.response?.thought || "No thought available"}
                                        </p>
                                    </div>
                                    <div>
                                        <span className="text-slate-400 block mb-1">New Memory</span>
                                        {lastReflection.response?.permanentMemory ? (
                                            <p className="text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded border border-amber-100 dark:border-amber-900/50">
                                                {lastReflection.response.permanentMemory}
                                            </p>
                                        ) : (
                                            <p className="text-slate-400 dark:text-slate-600 text-xs italic pl-1">
                                                No specific memory formed.
                                            </p>
                                        )}
                                    </div>
                                </motion.div>
                            )}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* Settings & Config */}
                <div className="p-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50">
                    <button
                        onClick={() => setShowApiConfig(!showApiConfig)}
                        className="w-full flex items-center justify-between p-2 text-xs font-medium text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-800 rounded transition-colors"
                    >
                        <span className="flex items-center gap-2">
                            <Settings className="w-4 h-4" />
                            API & Model Settings
                        </span>
                        {showApiConfig ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                    </button>

                    <AnimatePresence>
                        {showApiConfig && (
                            <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: 'auto' }}
                                exit={{ opacity: 0, height: 0 }}
                                className="overflow-hidden"
                            >
                                <div className="mt-2 space-y-3 p-2">
                                    <div>
                                        <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Provider</label>
                                        <div className="flex bg-slate-200 dark:bg-slate-800 rounded p-1">
                                            <button
                                                onClick={() => setLlmSettings(p => ({ ...p, provider: 'gemini' }))}
                                                className={`flex-1 py-1 text-xs rounded transition-all ${llmSettings.provider === 'gemini' ? 'bg-white dark:bg-slate-700 shadow text-blue-600 dark:text-blue-300 font-bold' : 'text-slate-500'}`}
                                            >
                                                Gemini
                                            </button>
                                            <button
                                                onClick={() => setLlmSettings(p => ({ ...p, provider: 'local' }))}
                                                className={`flex-1 py-1 text-xs rounded transition-all ${llmSettings.provider === 'local' ? 'bg-white dark:bg-slate-700 shadow text-green-600 dark:text-green-300 font-bold' : 'text-slate-500'}`}
                                            >
                                                Local LLM
                                            </button>
                                        </div>
                                    </div>

                                    {llmSettings.provider === 'local' && (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                            <div>
                                                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Endpoint</label>
                                                <div className="flex gap-1">
                                                    <input
                                                        type="text"
                                                        value={llmSettings.localEndpoint}
                                                        onChange={(e) => setLlmSettings(p => ({ ...p, localEndpoint: e.target.value }))}
                                                        className="flex-1 bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs"
                                                        placeholder="http://localhost:11434/v1"
                                                    />
                                                    <button onClick={testConnection} className="p-1.5 bg-slate-200 dark:bg-slate-700 rounded hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-600 dark:text-slate-300" title="Test Connection">
                                                        <CheckCircle className="w-4 h-4" />
                                                    </button>
                                                    <button onClick={fetchModels} className="p-1.5 bg-blue-100 dark:bg-blue-900/30 rounded hover:bg-blue-200 dark:hover:bg-blue-800/50 text-blue-600 dark:text-blue-300" title="Fetch Models">
                                                        {loadingModels ? <RefreshCw className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Chat Model</label>
                                                <select
                                                    value={llmSettings.localChatModel}
                                                    onChange={(e) => setLlmSettings(p => ({ ...p, localChatModel: e.target.value }))}
                                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs"
                                                >
                                                    {llmSettings.availableModels.length > 0 ? (
                                                        llmSettings.availableModels.map(m => <option key={m} value={m}>{m}</option>)
                                                    ) : (
                                                        <option value="llama3">llama3 (Default)</option>
                                                    )}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Reflection Model</label>
                                                <select
                                                    value={llmSettings.localReflectModel}
                                                    onChange={(e) => setLlmSettings(p => ({ ...p, localReflectModel: e.target.value }))}
                                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs"
                                                >
                                                    {llmSettings.availableModels.length > 0 ? (
                                                        llmSettings.availableModels.map(m => <option key={m} value={m}>{m}</option>)
                                                    ) : (
                                                        <option value="llama3">llama3 (Default)</option>
                                                    )}
                                                </select>
                                            </div>
                                        </div>
                                    )}

                                    {llmSettings.provider === 'gemini' && (
                                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2">
                                            <div>
                                                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Chat Model</label>
                                                <select
                                                    value={chatModel}
                                                    onChange={(e) => setChatModel(e.target.value)}
                                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs"
                                                >
                                                    {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-[10px] uppercase font-bold text-slate-400 mb-1">Reflect Model</label>
                                                <select
                                                    value={reflectModel}
                                                    onChange={(e) => setReflectModel(e.target.value)}
                                                    className="w-full bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded px-2 py-1 text-xs"
                                                >
                                                    {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                                </select>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </div>
        </div>
    );
}
