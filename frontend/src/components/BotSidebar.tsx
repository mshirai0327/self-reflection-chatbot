import { useState, useRef } from 'react';
import { Bot, Activity, Heart, Sparkles, Database, User, Terminal, FileText } from 'lucide-react';
import { motion } from 'framer-motion';

// Types (Sync with App.tsx)
interface PersonaStatus {
    id?: string; // statusId
    personaId?: string; // personaId (Added)
    name?: string;
    systemPrompt?: string; // systemPrompt (Added)
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
    systemPrompt?: string;
    userPrompt: string;
    contextMemories: { content: string | null; distance: number | null }[];
}

type BotSidebarProps = {
    isOpen: boolean;
    status: PersonaStatus;
    lastDebugInfo: DebugInfo | null;
    /** ステータス再取得コールバック（リロードせずにUIを更新するため） */
    onStatusRefresh?: () => Promise<void>;
};

export function BotSidebar({ isOpen, status, lastDebugInfo, onStatusRefresh }: BotSidebarProps) {
    const [activeTab, setActiveTab] = useState<'status' | 'debug'>('status');
    const [editingName, setEditingName] = useState(status.name);
    const [isEditingName, setIsEditingName] = useState(false);
    const isSubmitting = useRef(false);

    const [isEditingSystemPrompt, setIsEditingSystemPrompt] = useState(false);
    const [editingSystemPromptText, setEditingSystemPrompt] = useState('');

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
        { label: 'Sleep', value: `${status.sleepTime ?? '?'}h` },
        { label: 'BP', value: `${status.bloodPressureSys ?? '?'}/${status.bloodPressureDia ?? '?'}` },
    ];

    const handleStartEditName = () => {
        setEditingName(status.name || 'Reflecta');
        setIsEditingName(true);
    };

    const handleSaveName = async () => {
        if (isSubmitting.current) return;
        isSubmitting.current = true;

        if (!status.personaId) {
            console.error("No personaId found");
            setIsEditingName(false);
            isSubmitting.current = false;
            return;
        }
        try {
            await fetch(`${import.meta.env.VITE_API_URL || ''}/api/personas/${status.personaId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: editingName })
            });
            // 親コンポーネントからステータスを再取得（リロードせずにUIを更新）
            if (onStatusRefresh) {
                await onStatusRefresh();
            }
        } catch (e) {
            console.error(e);
        } finally {
            isSubmitting.current = false;
            setIsEditingName(false);
        }
    };
    
    const handleSaveSystemPrompt = async () => {
        if (isSubmitting.current) return;
        isSubmitting.current = true;
        
        try {
            await fetch(`${import.meta.env.VITE_API_URL || ''}/api/personas/${status.personaId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ systemPrompt: editingSystemPromptText })
            });
            // 親コンポーネントからステータスを再取得（リロードせずにUIを更新し、タブ状態を維持）
            if (onStatusRefresh) {
                await onStatusRefresh();
            }
        } catch (e) {
            console.error(e);
        } finally {
            isSubmitting.current = false;
            setIsEditingSystemPrompt(false);
        }
    };
    
    // Header Profile Section
    const renderHeaderProfile = () => (
        <div className="p-6 pb-2 flex flex-col items-center">
            <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-3 shadow-inner ring-4 ring-slate-50 dark:ring-slate-800">
                <Bot className="w-10 h-10 text-white" />
            </div>
            {isEditingName ? (
                 <input
                    type="text"
                    value={editingName}
                    onChange={(e) => setEditingName(e.target.value)}
                    onBlur={handleSaveName}
                    onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            e.stopPropagation();
                            handleSaveName();
                        }
                    }}
                    autoFocus
                    className="font-bold text-xl text-center text-slate-800 dark:text-slate-100 bg-transparent border-b border-blue-500 focus:outline-none mb-1"
                />
            ) : (
                <h2 
                    className="font-bold text-xl text-slate-800 dark:text-slate-100 tracking-tight cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800 px-2 rounded transition-colors"
                    onClick={handleStartEditName}
                    title="Click to edit name"
                >
                    {status.name || 'Reflecta'}
                </h2>
            )}
            <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-1">Self-Evolving AI</p>
        </div>
    );

    return (
        <div className={`bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 transition-all duration-300 flex-shrink-0 ${isOpen ? 'w-80' : 'w-0'} overflow-hidden shadow-lg flex flex-col`}>

            <div className="w-80 flex flex-col h-full relative">
                {/* Header Profile */}
                {renderHeaderProfile()}

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
                <div className="flex-1 overflow-y-auto p-4 space-y-6 scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700 pb-20">

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

                            {/* Personality Chart */}
                            <div>
                                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 px-1 flex items-center gap-1">
                                    <Terminal className="w-3 h-3" /> Personality (Lv2)
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
                            {/* User System Prompt 編集セクション（STATUSから移動） */}
                            <div>
                                <h3 className="text-xs font-bold text-purple-600 dark:text-purple-400 uppercase tracking-wider mb-2 px-1 flex justify-between items-center">
                                    <span className="flex items-center gap-2">
                                        <FileText className="w-3 h-3" /> Custom System Prompt
                                    </span>
                                    {!isEditingSystemPrompt && (
                                        <button 
                                            onClick={() => {
                                                setEditingSystemPrompt(status.systemPrompt || '');
                                                setIsEditingSystemPrompt(true);
                                            }}
                                            className="text-purple-500 hover:text-purple-600 text-[10px] font-normal"
                                        >
                                            Edit
                                        </button>
                                    )}
                                </h3>
                                {isEditingSystemPrompt ? (
                                    <div className="space-y-2">
                                        <textarea
                                            value={editingSystemPromptText}
                                            onChange={(e) => setEditingSystemPrompt(e.target.value)}
                                            className="w-full p-2 text-xs bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:ring-2 focus:ring-purple-500 outline-none min-h-[100px]"
                                            placeholder="追加のシステムプロンプトを入力..."
                                        />
                                        <div className="flex justify-end gap-2">
                                            <button 
                                                onClick={() => setIsEditingSystemPrompt(false)}
                                                className="text-xs text-slate-500 hover:text-slate-700"
                                            >
                                                Cancel
                                            </button>
                                            <button 
                                                onClick={handleSaveSystemPrompt}
                                                className="text-xs bg-purple-500 hover:bg-purple-600 text-white px-3 py-1 rounded"
                                            >
                                                Save
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="bg-slate-50 dark:bg-slate-800/50 rounded-lg p-3 text-xs text-slate-600 dark:text-slate-400 border border-slate-100 dark:border-slate-800 whitespace-pre-wrap">
                                        {status.systemPrompt || <span className="text-slate-400 italic">No additional system prompt set.</span>}
                                    </div>
                                )}
                            </div>

                            {/* Debug Info View */}
                            {!lastDebugInfo ? (
                                <div className="text-center py-10 text-slate-400">
                                    <Terminal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                                    <p className="text-sm">チャットが始まるまで表示されません<br />Start a conversation.</p>
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
                                        <h3 className="text-xs font-bold text-emerald-600 dark:text-emerald-400 tracking-wider mb-2 flex items-center gap-2">
                                            <Database className="w-3 h-3" /> ChromaDB Memories
                                        </h3>
                                        <div className="space-y-2">
                                            {lastDebugInfo.contextMemories.length === 0 ? (
                                                <div className="text-xs text-slate-400 italic p-2">No relevant memories found.</div>
                                            ) : (
                                                <div className="overflow-hidden rounded border border-emerald-100 dark:border-emerald-800/30">
                                                    <table className="w-full text-xs text-left border-collapse">
                                                        <thead className="bg-emerald-50 dark:bg-emerald-900/10">
                                                            <tr>
                                                                <th className="p-1 px-2 border-b border-emerald-100 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-300 font-mono text-[10px] w-16">Dist</th>
                                                                <th className="p-1 px-2 border-b border-emerald-100 dark:border-emerald-800/30 text-emerald-700 dark:text-emerald-300 font-mono text-[10px]">Content</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {lastDebugInfo.contextMemories.map((mem, i) => (
                                                                <tr key={i} className="border-b border-emerald-50 dark:border-emerald-800/20 last:border-0 hover:bg-emerald-50/50 dark:hover:bg-emerald-900/20 transition-colors">
                                                                    <td className="p-1 px-2 align-top font-mono text-emerald-600 dark:text-emerald-500 text-[10px]">
                                                                        {mem.distance !== null ? mem.distance.toFixed(3) : '-'}
                                                                    </td>
                                                                    <td className="p-1 px-2 align-top text-emerald-900 dark:text-emerald-100 opacity-90 break-words max-w-[200px]">
                                                                        {mem.content}
                                                                    </td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
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
                </div>
            </div>
        </div>
    );
}
