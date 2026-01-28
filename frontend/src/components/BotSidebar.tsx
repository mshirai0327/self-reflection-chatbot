import { Bot, Activity, Heart, Sparkles, Database, Menu } from 'lucide-react';

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
};

export function BotSidebar({ isOpen, onToggle, status }: BotSidebarProps) {
    const stats = [
        { icon: Heart, label: 'Health', value: `${status.health}%`, color: 'text-rose-500' },
        { icon: Sparkles, label: 'Emotion', value: `${status.mood}%`, color: 'text-amber-500' },
        { icon: Database, label: 'Trust', value: `${status.trust}%`, color: 'text-emerald-500' },
        { icon: Activity, label: 'Height/Weight', value: `${status.height.toFixed(1)}cm / ${status.weight.toFixed(1)}kg`, color: 'text-sky-500' }
    ];

    return (
        <div className={`bg-white border-r border-gray-200 transition-all duration-300 flex-shrink-0 ${isOpen ? 'w-64' : 'w-0'
            } overflow-hidden shadow-lg`}>
            <div className="w-64 p-6 flex flex-col h-full relative">
                {/* 折り畳みボタン */}
                <button
                    onClick={onToggle}
                    className="absolute top-4 left-4 p-2 hover:bg-gray-100 rounded-lg transition-colors z-10"
                    title="サイドバーを閉じる"
                >
                    <Menu className="w-5 h-5 text-gray-600" />
                </button>

                {/* ボットアバター */}
                <div className="flex flex-col items-center mb-6 mt-8">
                    <div className="w-20 h-20 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center mb-3 shadow-inner">
                        <Bot className="w-10 h-10 text-white" />
                    </div>
                    <h2 className="font-semibold text-gray-900">Reflecta</h2>
                </div>

                {/* 現在の気分 */}
                <div className="mb-6">
                    <h3 className="text-sm text-gray-500 mb-2">現在の気分</h3>
                    <div className="bg-blue-50 rounded-lg p-3 text-center border border-blue-100">
                        <span className="text-2xl">
                            {status.mood > 70 ? '😊' : status.mood > 40 ? '😐' : '😔'}
                            {status.mood > 70 ? '絶好調' : status.mood > 40 ? '穏やか' : '沈んでいる'}
                        </span>
                    </div>
                </div>

                {/* ステータス */}
                <div>
                    <h3 className="text-sm text-gray-500 mb-3">ステータス</h3>
                    <div className="space-y-3">
                        {stats.map((stat, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg border border-gray-100">
                                <div className="flex items-center gap-2">
                                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                                    <span className="text-sm text-gray-600">{stat.label}</span>
                                </div>
                                <span className="text-sm font-medium text-gray-900">{stat.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
