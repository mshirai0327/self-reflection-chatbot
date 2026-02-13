import { useState, useRef, useEffect } from 'react';
import { Bot, ChevronDown, PlusCircle, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * ペルソナの基本情報
 */
interface Persona {
    id: string;
    name: string;
}

/**
 * PersonaSelector コンポーネントの Props
 */
interface PersonaSelectorProps {
    /** 利用可能なペルソナ一覧 */
    personas: Persona[];
    /** 現在選択中のペルソナID */
    currentPersonaId: string | null;
    /** ペルソナ選択時のコールバック */
    onSelect: (personaId: string) => void;
    /** 新規ペルソナ作成ボタン押下時のコールバック */
    onCreateNew: () => void;
}

/**
 * カスタムドロップダウン形式のペルソナセレクター
 *
 * ネイティブの <select> を置き換え、アイコン・区切り線・Framer Motion のアニメーション付きで
 * リッチなUIを提供する。外側クリックで自動的に閉じる。
 */
export function PersonaSelector({
    personas,
    currentPersonaId,
    onSelect,
    onCreateNew,
}: PersonaSelectorProps) {
    const [isOpen, setIsOpen] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);

    /** 現在選択中のペルソナ名を取得 */
    const currentPersona = personas.find((p) => p.id === currentPersonaId);

    /**
     * ドロップダウン外側のクリックを検知して閉じる
     */
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen]);

    /**
     * ペルソナ選択ハンドラ
     */
    const handleSelect = (personaId: string) => {
        onSelect(personaId);
        setIsOpen(false);
    };

    /**
     * 新規作成ハンドラ
     */
    const handleCreateNew = () => {
        onCreateNew();
        setIsOpen(false);
    };

    return (
        <div ref={containerRef} className="relative ml-4">
            {/* トリガーボタン */}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`
                    flex items-center gap-2 pl-3 pr-2.5 py-1.5
                    bg-blue-50 dark:bg-slate-800
                    border border-blue-200 dark:border-slate-700
                    rounded-lg text-sm font-medium
                    text-slate-700 dark:text-slate-200
                    hover:bg-blue-100 dark:hover:bg-slate-700
                    focus:ring-2 focus:ring-blue-500 focus:outline-none
                    transition-colors cursor-pointer
                `}
            >
                <Bot className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
                <span className="truncate max-w-[140px]">
                    {currentPersona?.name || 'ペルソナ未選択'}
                </span>
                <ChevronDown
                    className={`w-4 h-4 text-slate-400 shrink-0 transition-transform duration-200 ${
                        isOpen ? 'rotate-180' : ''
                    }`}
                />
            </button>

            {/* ドロップダウンメニュー */}
            <AnimatePresence>
                {isOpen && (
                    <motion.div
                        initial={{ opacity: 0, y: -4, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -4, scale: 0.97 }}
                        transition={{ duration: 0.15, ease: 'easeOut' }}
                        className="
                            absolute top-full left-0 mt-1.5 z-50
                            min-w-[220px] w-max
                            bg-white dark:bg-slate-900
                            border border-slate-200 dark:border-slate-700
                            rounded-xl shadow-xl shadow-slate-200/50 dark:shadow-slate-900/50
                            overflow-hidden
                        "
                    >
                        {/* ペルソナリスト */}
                        <div className="py-1.5 max-h-60 overflow-y-auto scrollbar-thin scrollbar-thumb-slate-200 dark:scrollbar-thumb-slate-700">
                            {personas.length === 0 ? (
                                <div className="px-4 py-3 text-sm text-slate-400 italic text-center">
                                    ペルソナがありません
                                </div>
                            ) : (
                                personas.map((persona) => {
                                    const isSelected = persona.id === currentPersonaId;
                                    return (
                                        <button
                                            key={persona.id}
                                            onClick={() => handleSelect(persona.id)}
                                            className={`
                                                w-full flex items-center gap-2.5 px-3.5 py-2 text-sm text-left
                                                transition-colors duration-100
                                                ${isSelected
                                                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300'
                                                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800'
                                                }
                                            `}
                                        >
                                            {/* ペルソナアイコン */}
                                            <span
                                                className={`
                                                    w-7 h-7 rounded-full flex items-center justify-center shrink-0
                                                    ${isSelected
                                                        ? 'bg-blue-500 text-white'
                                                        : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500'
                                                    }
                                                `}
                                            >
                                                <Bot className="w-3.5 h-3.5" />
                                            </span>

                                            {/* ペルソナ名 */}
                                            <span className="flex-1 truncate font-medium">
                                                {persona.name}
                                            </span>

                                            {/* 選択中マーク */}
                                            {isSelected && (
                                                <Check className="w-4 h-4 text-blue-500 dark:text-blue-400 shrink-0" />
                                            )}
                                        </button>
                                    );
                                })
                            )}
                        </div>

                        {/* 区切り線 */}
                        <div className="border-t border-slate-100 dark:border-slate-800" />

                        {/* 新規作成ボタン */}
                        <div className="p-1.5">
                            <button
                                onClick={handleCreateNew}
                                className="
                                    w-full flex items-center gap-2.5 px-3.5 py-2 text-sm
                                    text-blue-600 dark:text-blue-400 font-medium
                                    hover:bg-blue-50 dark:hover:bg-blue-900/20
                                    rounded-lg transition-colors duration-100
                                "
                            >
                                <span className="w-7 h-7 rounded-full bg-blue-100 dark:bg-blue-900/40 flex items-center justify-center shrink-0">
                                    <PlusCircle className="w-3.5 h-3.5" />
                                </span>
                                <span>新しいペルソナを作成</span>
                            </button>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
