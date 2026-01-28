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
        //todo Height/Weightを縦に並べるのは見にくいうえ、私のL1-L4生体データ表現に合わない。要検討

        { icon: Activity, label: 'Height/Weight', value: `${status.height.toFixed(1)}cm / ${status.weight.toFixed(1)}kg`, color: 'text-blue-500 dark:text-sky-400' }
    ];

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
                    <div className="space-y-3">
                        {stats.map((stat, index) => (
                            <div key={index} className="flex items-center justify-between p-2 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700/50">
                                <div className="flex items-center gap-2">
                                    <stat.icon className={`w-4 h-4 ${stat.color}`} />
                                    <span className="text-sm text-slate-600 dark:text-slate-400">{stat.label}</span>
                                </div>
                                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{stat.value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}
