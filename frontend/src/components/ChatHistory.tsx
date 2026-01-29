import { MessageCircle, Clock, ChevronRight } from 'lucide-react';

type ChatLog = {
    id: string;
    title: string;
    lastMessage: string;
    lastUpdated: Date;
    unread: boolean;
};

type ChatHistoryProps = {
    isOpen: boolean;
    onToggle: () => void;
};

export function ChatHistory({ isOpen, onToggle }: ChatHistoryProps) {
    //todo APIから取得するように変更する
    const chatLogs: ChatLog[] = [
        {
            id: '1',
            title: '今日の会話',
            lastMessage: 'ありがとうございました',
            lastUpdated: new Date(2026, 0, 28, 14, 30),
            unread: false
        },
        {
            id: '2',
            title: '技術サポート',
            lastMessage: '問題が解決しました',
            lastUpdated: new Date(2026, 0, 27, 16, 20),
            unread: false
        },
        {
            id: '3',
            title: '製品について',
            lastMessage: '詳細を教えてください',
            lastUpdated: new Date(2026, 0, 26, 10, 15),
            unread: true
        }
    ];

    const formatDate = (date: Date) => {
        const today = new Date(2026, 0, 28);
        const yesterday = new Date(2026, 0, 27);

        if (date.toDateString() === today.toDateString()) {
            return date.toLocaleTimeString('ja-JP', { hour: '2-digit', minute: '2-digit' });
        } else if (date.toDateString() === yesterday.toDateString()) {
            return '昨日';
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
                    <h2 className="font-semibold text-slate-900 dark:text-slate-100">チャットログ</h2>
                    <button
                        onClick={onToggle}
                        className="p-2 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg transition-colors"
                        title="サイドバーを閉じる"
                    >
                        <ChevronRight className="w-5 h-5 text-slate-600 dark:text-slate-400" />
                    </button>
                </div>

                {/* チャットログリスト */}
                <div className="flex-1 overflow-y-auto">
                    {chatLogs.map((log) => (
                        <div
                            key={log.id}
                            className="p-4 border-b border-slate-100 dark:border-slate-800/50 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors group"
                        >
                            <div className="flex items-start justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <MessageCircle className="w-4 h-4 text-slate-400 dark:text-slate-500 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                                    <h3 className="font-medium text-slate-900 dark:text-slate-200 text-sm">{log.title}</h3>
                                </div>
                                {log.unread && (
                                    <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1 shadow-sm"></span>
                                )}
                            </div>
                            <p className="text-sm text-slate-500 dark:text-slate-400 truncate mb-2 ml-6">{log.lastMessage}</p>
                            <div className="flex items-center gap-1 ml-6 text-xs text-slate-400 dark:text-slate-500">
                                <Clock className="w-3 h-3" />
                                <span>{formatDate(log.lastUpdated)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
