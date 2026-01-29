import { useEffect, useState } from 'react';
import axios from 'axios';
import { MessageCircle, Clock, ChevronRight, PlusCircle } from 'lucide-react';

interface Chat {
    id: string;
    title: string;
    updatedAt: string;
    _count?: {
        chatLogs: number;
    };
}

type ChatHistoryProps = {
    isOpen: boolean;
    onToggle: () => void;
    refreshTrigger: number;
    onSelectChat: (id: string) => void;
    currentChatId: string | null;
    onNewChat: () => void;
};

const API_URL = import.meta.env.VITE_API_URL || '';

export function ChatHistory({
    isOpen,
    onToggle,
    refreshTrigger,
    onSelectChat,
    currentChatId,
    onNewChat
}: ChatHistoryProps) {
    const [chats, setChats] = useState<Chat[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const fetchChats = async () => {
            setIsLoading(true);
            try {
                console.log('[ChatHistory] Fetching chats from:', `${API_URL}/api/chats`);
                const res = await axios.get(`${API_URL}/api/chats`);
                console.log('[ChatHistory] Chats received:', res.data);
                setChats(res.data);
            } catch (error) {
                console.error('[ChatHistory] Failed to fetch chats:', error);
            } finally {
                setIsLoading(false);
            }
        };
        fetchChats();
    }, [refreshTrigger, currentChatId]);

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        const now = new Date();

        if (date.toDateString() === now.toDateString()) {
            return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        } else {
            return date.toLocaleDateString('ja-JP', { month: 'short', day: 'numeric' });
        }
    };

    return (
        <div className={`bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 transition-all duration-300 flex-shrink-0 ${isOpen ? 'w-72' : 'w-0'
            } overflow-hidden flex flex-col shadow-lg`}>
            <div className="w-72 h-full flex flex-col">
                {/* ヘッダー */}
                <div className="border-b border-slate-200 dark:border-slate-800 p-4 flex items-center justify-between bg-slate-50 dark:bg-slate-800/50">
                    <h2 className="font-semibold text-slate-900 dark:text-slate-100">チャット履歴</h2>
                    <div className="flex items-center gap-1">
                        <button
                            onClick={onNewChat}
                            className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors text-blue-600 dark:text-blue-400"
                            title="新規チャット"
                        >
                            <PlusCircle className="w-5 h-5" />
                        </button>
                        <button
                            onClick={onToggle}
                            className="p-2 hover:bg-white dark:hover:bg-slate-700 rounded-lg transition-colors"
                            title="サイドバーを閉じる"
                        >
                            <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                        </button>
                    </div>
                </div>

                {/* チャットログリスト */}
                <div className="flex-1 overflow-y-auto">
                    {isLoading && chats.length === 0 ? (
                        <div className="p-4 text-center text-slate-400 text-sm">読み込み中...</div>
                    ) : chats.length === 0 ? (
                        <div className="p-8 text-center text-slate-400 text-sm">履歴がありません</div>
                    ) : (
                        chats.map((chat) => (
                            <div
                                key={chat.id}
                                onClick={() => onSelectChat(chat.id)}
                                className={`p-4 border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group ${currentChatId === chat.id ? 'bg-blue-50 dark:bg-blue-900/20 border-l-4 border-l-blue-500' : ''
                                    }`}
                            >
                                <div className="flex items-start justify-between mb-1">
                                    <div className="flex items-center gap-2">
                                        <MessageCircle className={`w-4 h-4 transition-colors flex-shrink-0 ${currentChatId === chat.id ? 'text-blue-500' : 'text-slate-400 dark:text-slate-500 group-hover:text-blue-500'
                                            }`} />
                                        <h3 className={`font-medium text-sm truncate max-w-[180px] ${currentChatId === chat.id ? 'text-blue-700 dark:text-blue-400' : 'text-slate-900 dark:text-slate-200'
                                            }`}>{chat.title}</h3>
                                    </div>
                                    <span className="text-[10px] text-slate-400 dark:text-slate-500 whitespace-nowrap">
                                        {formatDate(chat.updatedAt)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between ml-6 text-xs text-slate-400 dark:text-slate-500">
                                    <div className="flex items-center gap-1">
                                        <Clock className="w-3 h-3" />
                                        <span>{chat._count?.chatLogs || 0} メッセージ</span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
