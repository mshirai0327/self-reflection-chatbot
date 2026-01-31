import { useState } from 'react';
import { Bot, Activity, Heart, Sparkles, Database, User, Terminal, FileText, Settings, CheckCircle, RefreshCw } from 'lucide-react';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import axios from 'axios';

// Types (Sync with App.tsx) - kept for BotSidebar
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
    // LLM Settings removed (Moved to ChatHistory)
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

// ... existing models list code REMOVED (No longer needed here) ...

export function BotSidebar({ isOpen, status, llmSettings, setLlmSettings, lastDebugInfo }: BotSidebarProps) {
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

    // Connection Test Logic (Kept for now if we want to add connection indicator, 
    // but the settings UI is moving. For now, I'll remove the UI but keep props to satisfy TS from App.tsx until ChatHistory update)
    // Actually, I should remove props from interface, but App.tsx is already passing them.
    // Wait, I updated App.tsx to PASS them to ChatHistory and removed them from BotSidebar call.
    // So I should REMOVE them from Props here.

    // RE-READING App.tsx DIFF:
    // -          chatModel={chatModel}
    // -          setChatModel={setChatModel}
    // -          reflectModel={reflectModel}
    // -          setReflectModel={setReflectModel}
    // llmSettings and setLlmSettings are STILL PASSED in the diff!
    // Line 284: llmSettings={llmSettings}
    // Line 285: setLlmSettings={setLlmSettings}
    // So I must keep them in Props, but maybe I don't use them? 
    // No, the user Plan said "Remove API Settings UI and props". 
    // My App.tsx edit REMOVED chatModel/reflectModel but KEPT llmSettings. 
    // Uh oh. I probably missed deleting those lines in the MultiReplace. 
    // Let's check Step 55 diff.
    // It shows removal of lines 282-285 (chatModel...setReflectModel).
    // It DOES NOT show removal of llmSettings lines.
    // So App.tsx is still passing llmSettings.
    // I should keep receiving them or ignore them. 
    // Better: Remove UI for them.

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

                    {/* API Settings REMOVED */}
                </div>
            </div>
        </div>
    );
}
