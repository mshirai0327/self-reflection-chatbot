import { useState } from 'react';
import { X, Users } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface Persona {
    id: string;
    name: string;
}

interface GroupChatCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreate: (title: string, personaIds: string[]) => void;
    personas: Persona[];
}

/**
 * グループチャット作成モーダル。
 * 複数のペルソナを選択してグループチャットを開始するためのUI。
 */
export function GroupChatCreationModal({
    isOpen,
    onClose,
    onCreate,
    personas,
}: GroupChatCreationModalProps) {
    const [title, setTitle] = useState('');
    const [selectedPersonaIds, setSelectedPersonaIds] = useState<string[]>([]);

    /** ペルソナの選択/解除をトグル */
    const togglePersona = (personaId: string) => {
        setSelectedPersonaIds(prev =>
            prev.includes(personaId)
                ? prev.filter(id => id !== personaId)
                : [...prev, personaId]
        );
    };

    /** グループチャットを作成 */
    const handleCreate = () => {
        if (selectedPersonaIds.length < 2) return;
        onCreate(title || 'New Group Chat', selectedPersonaIds);
        // 状態をリセット
        setTitle('');
        setSelectedPersonaIds([]);
        onClose();
    };

    /** モーダルを閉じるときに状態をリセット */
    const handleClose = () => {
        setTitle('');
        setSelectedPersonaIds([]);
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
                    onClick={handleClose}
                >
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-md border border-slate-200 dark:border-slate-700"
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* ヘッダー */}
                        <div className="flex items-center justify-between p-5 border-b border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-2">
                                <Users className="w-5 h-5 text-purple-500" />
                                <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
                                    グループチャットを作成
                                </h2>
                            </div>
                            <button
                                onClick={handleClose}
                                className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                <X className="w-4 h-4 text-slate-400" />
                            </button>
                        </div>

                        {/* コンテンツ */}
                        <div className="p-5 space-y-4">
                            {/* タイトル入力 */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                    タイトル
                                </label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={(e) => setTitle(e.target.value)}
                                    placeholder="New Group Chat"
                                    className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-purple-500/30 focus:border-purple-500 transition-all"
                                />
                            </div>

                            {/* ペルソナ選択 */}
                            <div>
                                <label className="block text-xs font-semibold text-slate-500 dark:text-slate-400 mb-1.5">
                                    参加ペルソナを選択（2つ以上）
                                </label>
                                <div className="space-y-1.5 max-h-48 overflow-y-auto">
                                    {personas.map((persona) => {
                                        const isSelected = selectedPersonaIds.includes(persona.id);
                                        return (
                                            <button
                                                key={persona.id}
                                                onClick={() => togglePersona(persona.id)}
                                                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${
                                                    isSelected
                                                        ? 'bg-purple-50 dark:bg-purple-900/20 border-2 border-purple-400 dark:border-purple-500 text-purple-700 dark:text-purple-300 font-medium'
                                                        : 'bg-slate-50 dark:bg-slate-800 border-2 border-transparent hover:border-slate-300 dark:hover:border-slate-600 text-slate-700 dark:text-slate-300'
                                                }`}
                                            >
                                                <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
                                                    isSelected
                                                        ? 'border-purple-500 bg-purple-500'
                                                        : 'border-slate-300 dark:border-slate-600'
                                                }`}>
                                                    {isSelected && (
                                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                                <span>{persona.name}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                                {personas.length < 2 && (
                                    <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                                        ⚠ ペルソナが2つ以上必要です。先にペルソナを作成してください。
                                    </p>
                                )}
                            </div>
                        </div>

                        {/* フッター */}
                        <div className="flex justify-end gap-2 p-5 border-t border-slate-200 dark:border-slate-700">
                            <button
                                onClick={handleClose}
                                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
                            >
                                キャンセル
                            </button>
                            <button
                                onClick={handleCreate}
                                disabled={selectedPersonaIds.length < 2}
                                className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
                                    selectedPersonaIds.length >= 2
                                        ? 'bg-purple-600 hover:bg-purple-700 text-white shadow-md hover:shadow-lg'
                                        : 'bg-slate-200 dark:bg-slate-700 text-slate-400 dark:text-slate-500 cursor-not-allowed'
                                }`}
                            >
                                作成 ({selectedPersonaIds.length} ペルソナ)
                            </button>
                        </div>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
