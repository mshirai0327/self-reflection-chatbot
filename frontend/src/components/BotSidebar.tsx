import { Bot, Activity, Heart, Sparkles, Database, Menu, Settings, RefreshCw, CheckCircle } from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';

type BotSidebarProps = {
    isOpen: boolean;
    onToggle: () => void;
    status: {
        health: number;
        mood: number;
        trust: number;
        height: number;
        weight: number;
    };
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
};

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

export function BotSidebar({ isOpen, onToggle, status, chatModel, setChatModel, reflectModel, setReflectModel, llmSettings, setLlmSettings }: BotSidebarProps) {
    const stats = [
        { icon: Heart, label: 'Health', value: `${status.health}%`, color: 'text-rose-500' },
        { icon: Sparkles, label: 'Emotion', value: `${status.mood}%`, color: 'text-amber-500' },
        { icon: Database, label: 'Trust', value: `${status.trust}%`, color: 'text-emerald-500' },
        { icon: Activity, label: 'Height/Weight', value: `${status.height.toFixed(1)}cm / ${status.weight.toFixed(1)}kg`, color: 'text-blue-500 dark:text-sky-400' }
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
        <div className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex-shrink-0 ${isOpen ? 'w-64' : 'w-0'
            } overflow-hidden shadow-lg`}>
            <div className="w-64 p-6 flex flex-col h-full relative">
                {/* 折り畳みボタン */}
                <button
                    onClick={onToggle}
                    className="absolute top-4 left-4 p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors z-10"
                    title="サイドバーを閉じる"
                >
                    <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                </button>

                {/* ボットアバター */}
                <div className="flex flex-col items-center mb-6 mt-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-3 shadow-inner">
                        <Bot className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="font-semibold text-slate-900 dark:text-slate-100">Reflecta</h2>
                </div>

                {/* 現在の気分 */}
                <div className="mb-6">
                    <h3 className="text-sm text-slate-500 dark:text-slate-400 mb-2 font-medium">現在の気分</h3>
                    <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 text-center border border-blue-100 dark:border-blue-800/50">
                        <span className="text-xl dark:text-slate-200">
                            {status.mood > 70 ? '😊' : status.mood > 40 ? '😐' : '😔'}
                            <span className="ml-2 font-medium">
                                {/* todo APIから取得するように変更する */}
                                {status.mood > 70 ? '絶好調' : status.mood > 40 ? '穏やか' : '沈んでいる'}
                            </span>
                        </span>
                    </div>
                </div>

                {/* ステータス */}
                <div>
                    <h3 className="text-sm text-slate-500 dark:text-slate-400 mb-3 font-medium">ステータス</h3>
                    <div className="space-y-2">
                        {stats.map((stat, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700/50">
                                <div className="flex items-center gap-2">
                                    <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
                                    <span className="text-xs text-slate-600 dark:text-slate-400">{stat.label}</span>
                                </div>
                                <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">{stat.value}</span>
                            </div>
                        ))}
                    </div>
                </div>

                {/* API設定 */}
                <div className="flex-1 overflow-y-auto pr-2 -mr-2">
                    <h3 className="text-sm text-slate-500 dark:text-slate-400 mb-3 font-medium flex items-center gap-2 sticky top-0 bg-white dark:bg-slate-900 py-1">
                        <Settings className="w-4 h-4" />
                        API構成
                    </h3>
                    <div className="space-y-4 pb-4">
                        <div>
                            <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">プロバイダー</label>
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
                                    Local LLM
                                </button>
                            </div>
                        </div>

                        {llmSettings.provider === 'gemini' ? (
                            <>
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">チャット</label>
                                    <select
                                        value={chatModel}
                                        onChange={(e) => setChatModel(e.target.value)}
                                        className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-700 dark:text-slate-200"
                                    >
                                        {MODELS.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">内省</label>
                                    <select
                                        value={reflectModel}
                                        onChange={(e) => setReflectModel(e.target.value)}
                                        className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-700 dark:text-slate-200"
                                    >
                                        {MODELS.map(m => (
                                            <option key={m.value} value={m.value}>{m.label}</option>
                                        ))}
                                    </select>
                                </div>
                            </>
                        ) : (
                            <>
                                <div>
                                    <div className="flex justify-between items-center mb-1">
                                        <label className="text-xs text-slate-500 dark:text-slate-400 block">エンドポイント</label>
                                        <div className="flex gap-2">
                                            <button
                                                onClick={testConnection}
                                                className="text-[10px] flex items-center gap-1 text-emerald-600 dark:text-emerald-400 hover:underline"
                                                title="接続を確認"
                                            >
                                                <CheckCircle className="w-2.5 h-2.5" />
                                                疎通確認
                                            </button>
                                            <button
                                                onClick={fetchModels}
                                                className="text-[10px] flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline"
                                                title="モデル一覧を取得"
                                            >
                                                <RefreshCw className="w-2.5 h-2.5" />
                                                取得
                                            </button>
                                        </div>
                                    </div>
                                    <input
                                        type="text"
                                        value={llmSettings.localEndpoint}
                                        onChange={(e) => setLlmSettings(prev => ({ ...prev, localEndpoint: e.target.value }))}
                                        placeholder="http://localhost:11434/v1"
                                        className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-700 dark:text-slate-200 mb-2"
                                    />
                                </div>
                                <div>
                                    <label className="text-xs text-slate-500 dark:text-slate-400 block mb-1">モデル名</label>
                                    {llmSettings.availableModels.length > 0 ? (
                                        <select
                                            value={llmSettings.localModel}
                                            onChange={(e) => setLlmSettings(prev => ({ ...prev, localModel: e.target.value }))}
                                            className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-700 dark:text-slate-200"
                                        >
                                            {llmSettings.availableModels.map(m => (
                                                <option key={m} value={m}>{m}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            value={llmSettings.localModel}
                                            onChange={(e) => setLlmSettings(prev => ({ ...prev, localModel: e.target.value }))}
                                            placeholder="llama3, qwen2..."
                                            className="w-full text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-2 text-slate-700 dark:text-slate-200"
                                        />
                                    )}
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
}
