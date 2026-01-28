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
        },
        {
            id: '4',
            title: '一般的な質問',
            lastMessage: 'わかりました',
            lastUpdated: new Date(2026, 0, 25, 9, 45),
            unread: false
        },
        {
            id: '5',
            title: 'アカウント設定',
            lastMessage: '変更完了しました',
            lastUpdated: new Date(2026, 0, 24, 13, 0),
            unread: false
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
        <div className={`bg-white border-l border-gray-200 transition-all duration-300 flex-shrink-0 ${isOpen ? 'w-72' : 'w-0'
            } overflow-hidden flex flex-col shadow-lg`}>
            <div className="w-72 h-full flex flex-col">
                {/* ヘッダー */}
                <div className="border-b border-gray-200 p-4 flex items-center justify-between bg-gray-50/50">
                    <h2 className="font-semibold text-gray-900">チャットログ</h2>
                    <button
                        onClick={onToggle}
                        className="p-2 hover:bg-gray-200 rounded-lg transition-colors"
                        title="サイドバーを閉じる"
                    >
                        <ChevronRight className="w-5 h-5 text-gray-600" />
                    </button>
                </div>

                {/* チャットログリスト */}
                <div className="flex-1 overflow-y-auto">
                    {chatLogs.map((log) => (
                        <div
                            key={log.id}
                            className="p-4 border-b border-gray-100 hover:bg-gray-50 cursor-pointer transition-colors group"
                        >
                            <div className="flex items-start justify-between mb-1">
                                <div className="flex items-center gap-2">
                                    <MessageCircle className="w-4 h-4 text-gray-400 group-hover:text-blue-500 transition-colors flex-shrink-0" />
                                    <h3 className="font-medium text-gray-900 text-sm">{log.title}</h3>
                                </div>
                                {log.unread && (
                                    <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1 shadow-sm"></span>
                                )}
                            </div>
                            <p className="text-sm text-gray-500 truncate mb-2 ml-6">{log.lastMessage}</p>
                            <div className="flex items-center gap-1 ml-6 text-xs text-gray-400">
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
