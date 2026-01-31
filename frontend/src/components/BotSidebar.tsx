import { useState } from 'react';
import { Bot, Activity, Heart, Sparkles, Database, Settings, RefreshCw, CheckCircle, Brain, User, Terminal, FileText, ChevronDown, ChevronRight, Info } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

// Types (Sync with App.tsx)
interface PersonaStatus {
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
    height: number;
    weight: number;
    boneDensity?: number;
    bloodSugar?: number;
    bloodPressureSys?: number;
    bloodPressureDia?: number;
    sleepTime?: number;
    sleepQuality?: number;
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

type BotSidebarProps = {
    isOpen: boolean;
    status: PersonaStatus;
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
    lastDebugInfo: DebugInfo | null;
};

// ... existing models list code ...
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

export function BotSidebar({ isOpen, status, chatModel, setChatModel, reflectModel, setReflectModel, llmSettings, setLlmSettings, lastDebugInfo }: BotSidebarProps) {
    const [activeTab, setActiveTab] = useState<'status' | 'debug'>('status');

    // Stats Categorization
    const conditionStats = [
        { icon: Heart, label: 'Health', value: `${status.health}%`, color: 'text-rose-500' },
        { icon: Sparkles, label: 'Mood', value: `${status.mood}%`, color: 'text-amber-500' },
        { icon: Database, label: 'Trust', value: `${status.trust}%`, color: 'text-emerald-500' },
        { icon: User, label: 'Friendliness', value: `${status.friendliness || 0}%`, color: 'text-pink-500' },
    ];

    const profileStats = [
        { label: 'Name', value: status.name || 'Reflecta' },
        { label: 'Age', value: status.birthDate ? `${new Date().getFullYear() - new Date(status.birthDate).getFullYear()}歳` : 'Unknown' },
        { label: 'Gender', value: status.gender || 'Unknown' },
        { label: 'Type', value: status.chronotype || 'Unknown' },
        { label: 'IQ', value: status.intelligence?.toString() || '?' },
    ];

    const personalityStats = [
        { label: 'Ethics', value: status.ethics },
        { label: 'Passion', value: status.passion },
        { label: 'Curiosity', value: status.curiosity },
        { label: 'Aggression', value: status.aggressiveness },
        { label: 'Extroversion', value: status.extroversion },
    ];

    const bodyStats = [
        { label: 'Height', value: `${status.height}cm` },
        { label: 'Weight', value: `${status.weight}kg` },
        { label: 'Sleep', value: `${status.sleepTime || '?'}h` },
        { label: 'BP', value: `${status.bloodPressureSys || '?'}/${status.bloodPressureDia || '?'}` },
    ];

    const testConnection = async () => {
        const loadingToast = toast.loading('接続を確認中...');
        try {
            const res = await axios.post('/api/llm/test', {
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
            const res = await axios.post('/api/llm/models', {
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
        <div className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex-shrink-0 ${isOpen ? 'w-80' : 'w-0'
            } overflow-hidden shadow-lg flex flex-col`}>

            <div className="w-80 flex flex-col h-full relative">
                {/* Header Profile */}
                <div className="p-6 pb-2 flex flex-col items-center">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-3 shadow-inner ring-4 ring-slate-50 dark:ring-slate-800">
                        <Bot className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="font-bold text-xl text-slate-800 dark:text-slate-100 tracking-tight">Reflecta</h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">Self-Evolving AI</p>
                </div>

                {/* Tabs */}
                <div className="flex border-b border-slate-200 dark:border-slate-800 px-4">
                    <button
                        onClick={() => setActiveTab('status')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === 'status' ? 'text-blue-600 dark:text-blue-400' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        STATUS
                        {activeTab === 'status' && <motion.div layoutId="underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400" />}
                    </button>
                    <button
                        onClick={() => setActiveTab('debug')}
                        className={`flex-1 py-3 text-sm font-medium transition-colors relative ${activeTab === 'debug' ? 'text-purple-600 dark:text-purple-400' : 'text-slate-500 dark:text-slate-500 hover:text-slate-700 dark:hover:text-slate-300'}`}
                    >
                        DEBUG MODE
                        {activeTab === 'debug' && <motion.div layoutId="underline" className="absolute bottom-0 left-0 right-0 h-0.5 bg-purple-600 dark:bg-purple-400" />}
                    </button>
                </div>

                {/* Scrollable Content */}
                <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">

                    {activeTab === 'status' ? (
                        <div className="space-y-6">
                            {/* Current Mood Large Display */}
                            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-slate-800 dark:to-slate-800/50 rounded-xl p-4 text-center border border-blue-100 dark:border-slate-700">
                                <span className="text-3xl block mb-1">
                                    {status.mood > 80 ? '😁' : status.mood > 60 ? '🙂' : status.mood > 40 ? '😐' : '😔'}
                                </span>
                                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300 block">
                                    Current Mood: {status.mood}%
                                </span>
                            </div>

                            {/* Condition Group */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1">Current Condition</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {conditionStats.map((stat, i) => (
                                        <div key={i} className="bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-100 dark:border-slate-700/50 flex flex-col items-center">
                                            <stat.icon className={`w-5 h-5 mb-1 ${stat.color}`} />
                                            <span className="text-xs text-slate-500 dark:text-slate-400">{stat.label}</span>
                                            <span className="font-bold text-slate-700 dark:text-slate-200">{stat.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Profile Group */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1 flex items-center gap-1">
                                    <User className="w-3 h-3" /> Basic Profile
                                </h3>
                                <div className="bg-white dark:bg-slate-900 rounded-lg border border-slate-200 dark:border-slate-800 divide-y divide-slate-100 dark:divide-slate-800">
                                    {profileStats.map((stat, i) => (
                                        <div key={i} className="flex justify-between p-3 text-sm">
                                            <span className="text-slate-500 dark:text-slate-400">{stat.label}</span>
                                            <span className="font-medium text-slate-900 dark:text-slate-200">{stat.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Body Stats */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1 flex items-center gap-1">
                                    <Activity className="w-3 h-3" /> Body
                                </h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {bodyStats.map((stat, i) => (
                                        <div key={i} className="flex justify-between p-2 bg-slate-50 dark:bg-slate-800/30 rounded border border-slate-100 dark:border-slate-800 text-xs">
                                            <span className="text-slate-500">{stat.label}</span>
                                            <span className="font-mono text-slate-700 dark:text-slate-300">{stat.value}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Personality Chart (Simulated with progress bars) */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1 flex items-center gap-1">
                                    <Brain className="w-3 h-3" /> Personality (Lv2)
                                </h3>
                                <div className="space-y-3">
                                    {personalityStats.map((stat, i) => (
                                        <div key={i}>
                                            <div className="flex justify-between text-xs mb-1">
                                                <span className="text-slate-600 dark:text-slate-300">{stat.label}</span>
                                                <span className="text-slate-400">{stat.value ?? 50}/100</span>
                                            </div>
                                            <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                                                <motion.div
                                                    initial={{ width: 0 }}
                                                    animate={{ width: `${stat.value ?? 50}%` }}
                                                    className="h-full bg-indigo-500 rounded-full"
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            {/* Debug Info View */}
                            {!lastDebugInfo ? (
                                <div className="text-center py-10 text-slate-400">
                                    <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">No internal logs yet.<br />Start a conversation.</p>
                                </div>
                            ) : (
                                <>
                                    {/* System Prompt */}
                                    <div>
                                        <h3 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <Terminal className="w-3 h-3" /> System Prompt
                                        </h3>
                                        <div className="bg-slate-900 text-slate-300 p-3 rounded-lg text-[10px] font-mono leading-relaxed overflow-x-auto border border-slate-800 max-h-60 overflow-y-auto whitespace-pre-wrap">
                                            {lastDebugInfo.systemPrompt}
                                        </div>
                                    </div>

                                    {/* Vector Memories */}
                                    <div>
                                        <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <Database className="w-3 h-3" /> Retrieved Memories (RAG)
                                        </h3>
                                        <div className="space-y-2">
                                            {lastDebugInfo.contextMemories.length === 0 ? (
                                                <div className="text-xs text-slate-400 italic p-2">No relevant memories found.</div>
                                            ) : (
                                                lastDebugInfo.contextMemories.map((mem, i) => (
                                                    <div key={i} className="bg-emerald-50 dark:bg-emerald-900/20 text-emerald-900 dark:text-emerald-100 p-2 rounded text-xs border border-emerald-100 dark:border-emerald-800/50">
                                                        "{mem}"
                                                    </div>
                                                ))
                                            )}
                                        </div>
                                    </div>

                                    {/* User Input raw */}
                                    <div>
                                        <h3 className="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-wider mb-2 flex items-center gap-2">
                                            <FileText className="w-3 h-3" /> Raw User Input
                                        </h3>
                                        <div className="bg-slate-100 dark:bg-slate-800 p-2 rounded border border-slate-200 dark:border-slate-700 text-xs font-mono text-slate-600 dark:text-slate-300">
                                            {lastDebugInfo.userPrompt}
                                        </div>
                                    </div>
                                </>
                            )}
                        </div>
                    )}

                    {/* API Settings Section (Collapsible in future, kept at bottom) */}
                    <div className="pt-4 mt-4 border-t border-slate-200 dark:border-slate-800">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-2">
                            <Settings className="w-3 h-3" /> API Configuration
                        </h3>
                        <div className="space-y-3">
                            <div>
                                <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">Provider</label>
                                <div className="flex bg-slate-100 dark:bg-slate-800 rounded-lg p-1">
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
                                        Local
                                    </button>
                                </div>
                            </div>

                            {llmSettings.provider === 'gemini' ? (
                                <div className="space-y-2">
                                    <div>
                                        <label className="text-[10px] text-slate-500 block mb-1">Chat Model</label>
                                        <select value={chatModel} onChange={(e) => setChatModel(e.target.value)} className="w-full text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded p-1.5">
                                            {MODELS.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] text-slate-500 block mb-1">Reflection Model</label>
                                        <select value={reflectModel} onChange={(e) => setReflectModel(e.target.value)} className="w-full text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded p-1.5">
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
                                            className="flex-1 text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded p-1.5"
                                            placeholder="Endpoint"
                                        />
                                        <button onClick={testConnection} className="p-1.5 bg-emerald-100 text-emerald-600 rounded"><CheckCircle size={14} /></button>
                                        <button onClick={fetchModels} className="p-1.5 bg-blue-100 text-blue-600 rounded"><RefreshCw size={14} /></button>
                                    </div>
                                    <select value={llmSettings.localModel} onChange={(e) => setLlmSettings(p => ({ ...p, localModel: e.target.value }))} className="w-full text-xs bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 rounded p-1.5">
                                        {llmSettings.availableModels.length ? llmSettings.availableModels.map(m => <option key={m} value={m}>{m}</option>) : <option>{llmSettings.localModel}</option>}
                                    </select>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
