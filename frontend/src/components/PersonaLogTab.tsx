import { useEffect, useState } from 'react';
import axios from 'axios';
import { Activity, TrendingUp, AlertCircle, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    Legend,
    ResponsiveContainer,
} from 'recharts';

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * 不可逆データのフィールド定義
 * グラフ表示用のラベルと色を管理
 */
const IRREVERSIBLE_FIELDS = [
    { key: 'height', label: '身長 (cm)', color: '#3b82f6' },
    { key: 'boneDensity', label: '骨密度', color: '#10b981' },
    { key: 'gripStrength', label: '握力 (kg)', color: '#f59e0b' },
    { key: 'voicePitch', label: '声の高さ (Hz)', color: '#8b5cf6' },
    { key: 'eyesight', label: '視力', color: '#ef4444' },
    { key: 'hearingAbility', label: '聴力 (dB)', color: '#06b6d4' },
];

/**
 * 感情・状態データのフィールド定義
 */
const EMOTION_FIELDS = [
    { key: 'mood', label: '気分', color: '#f59e0b' },
    { key: 'trust', label: '信頼度', color: '#3b82f6' },
    { key: 'health', label: '健康', color: '#10b981' },
    { key: 'friendliness', label: '友好度', color: '#8b5cf6' },
];

interface PersonaLogTabProps {
    /** 現在選択中のペルソナID */
    currentPersonaId: string | null;
}

/** 不可逆ステータスレコードの型 */
interface IrreversibleRecord {
    id: string;
    version: number;
    height: number | null;
    boneDensity: number | null;
    gripStrength: number | null;
    voicePitch: number | null;
    eyesight: number | null;
    hearingAbility: number | null;
    recordedAt: string;
}

/** 感情データ（JSON value）の1項目 */
interface EmotionDataItem {
    label: string;
    value: number;
    unit: string | null;
}

/** 可逆半定量ステータスレコードの型 */
interface SemiquantityRecord {
    id: string;
    version: number;
    value: EmotionDataItem[];
    recordedAt: string;
}

/**
 * 人格ログタブコンポーネント
 * ペルソナの不可逆データと感情データの時系列グラフを表示する
 */
export function PersonaLogTab({ currentPersonaId }: PersonaLogTabProps) {
    const [irreversibleData, setIrreversibleData] = useState<IrreversibleRecord[]>([]);
    const [semiquantityData, setSemiquantityData] = useState<SemiquantityRecord[]>([]);
    const [personaName, setPersonaName] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    /** 不可逆データで表示するフィールドの選択状態 */
    const [activeFields, setActiveFields] = useState<Set<string>>(new Set(['height', 'boneDensity']));
    /** 感情データで表示するフィールドの選択状態 */
    const [activeEmotionFields, setActiveEmotionFields] = useState<Set<string>>(new Set(['mood', 'trust', 'health']));

    /**
     * ペルソナの履歴データを取得する
     */
    const fetchHistory = async () => {
        if (!currentPersonaId) return;
        setIsLoading(true);
        setError(null);
        try {
            const res = await axios.get(`${API_URL}/api/personas/${currentPersonaId}/history`);
            setIrreversibleData(res.data.irreversibleHistory || []);
            setSemiquantityData(res.data.semiquantityHistory || []);
            setPersonaName(res.data.personaName || '');
        } catch (err) {
            console.error('[PersonaLogTab] Failed to fetch history:', err);
            setError('履歴データの取得に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory();
    }, [currentPersonaId]);

    /**
     * 不可逆データをグラフ用にフォーマット
     * 横軸を記録回数（版数）にする
     */
    const formatIrreversibleChartData = () => {
        return irreversibleData.map((record, index) => ({
            index: index + 1,
            version: record.version,
            date: new Date(record.recordedAt).toLocaleDateString('ja-JP', {
                month: 'short',
                day: 'numeric',
            }),
            height: record.height,
            boneDensity: record.boneDensity,
            gripStrength: record.gripStrength,
            voicePitch: record.voicePitch,
            eyesight: record.eyesight,
            hearingAbility: record.hearingAbility,
        }));
    };

    /**
     * 感情データをグラフ用にフォーマット
     */
    const formatEmotionChartData = () => {
        return semiquantityData.map((record, index) => {
            const dataPoint: Record<string, number | string | null> = {
                index: index + 1,
                version: record.version,
                date: new Date(record.recordedAt).toLocaleDateString('ja-JP', {
                    month: 'short',
                    day: 'numeric',
                }),
            };
            // JSON value 配列から各フィールドを展開
            if (Array.isArray(record.value)) {
                record.value.forEach((item: EmotionDataItem) => {
                    dataPoint[item.label] = item.value;
                });
            }
            return dataPoint;
        });
    };

    /**
     * フィールドの表示/非表示をトグルする
     */
    const toggleField = (key: string) => {
        setActiveFields(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    /**
     * 感情フィールドの表示/非表示をトグルする
     */
    const toggleEmotionField = (key: string) => {
        setActiveEmotionFields(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    if (!currentPersonaId) {
        return (
            <div className="flex-1 flex items-center justify-center text-slate-400 dark:text-slate-600">
                <p>ペルソナを選択してください</p>
            </div>
        );
    }

    return (
        <div className="flex-1 overflow-y-auto px-6 py-6 scrollbar-thin">
            <div className="w-full max-w-[900px] mx-auto space-y-8">
                {/* ヘッダー */}
                <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex items-center justify-between"
                >
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-indigo-100 dark:bg-indigo-900/30 rounded-xl">
                            <Activity className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-slate-800 dark:text-slate-100">
                                {personaName || 'Persona'} の人格ログ
                            </h2>
                            <p className="text-sm text-slate-500 dark:text-slate-400">
                                不可逆データと感情データの時系列変化
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={fetchHistory}
                        disabled={isLoading}
                        className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors disabled:opacity-50"
                        title="データを更新"
                    >
                        <RefreshCw className={`w-5 h-5 text-slate-500 ${isLoading ? 'animate-spin' : ''}`} />
                    </button>
                </motion.div>

                {/* エラー表示 */}
                <AnimatePresence>
                    {error && (
                        <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="flex items-center gap-2 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl text-red-600 dark:text-red-400 text-sm"
                        >
                            <AlertCircle className="w-4 h-4 flex-shrink-0" />
                            {error}
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ローディング */}
                {isLoading && (
                    <div className="flex items-center justify-center py-12">
                        <div className="flex gap-2">
                            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" />
                            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                            <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                        </div>
                    </div>
                )}

                {/* 不可逆データ（Lv2）グラフセクション */}
                {!isLoading && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-5 h-5 text-blue-500" />
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                                不可逆的成長データ (Lv2)
                            </h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                            身長・骨密度・握力など、加齢や経験に伴い蓄積的に変化する指標
                        </p>

                        {/* フィールドフィルター */}
                        <div className="flex flex-wrap gap-2 mb-6">
                            {IRREVERSIBLE_FIELDS.map(field => (
                                <button
                                    key={field.key}
                                    onClick={() => toggleField(field.key)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                                        activeFields.has(field.key)
                                            ? 'text-white shadow-sm'
                                            : 'bg-transparent text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:border-slate-400'
                                    }`}
                                    style={
                                        activeFields.has(field.key)
                                            ? { backgroundColor: field.color, borderColor: field.color }
                                            : {}
                                    }
                                >
                                    {field.label}
                                </button>
                            ))}
                        </div>

                        {/* グラフ本体 */}
                        {irreversibleData.length > 0 ? (
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={formatIrreversibleChartData()}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                        <XAxis
                                            dataKey="index"
                                            label={{ value: '記録回数', position: 'insideBottomRight', offset: -5, fontSize: 12 }}
                                            tick={{ fontSize: 11 }}
                                            stroke="var(--text-secondary)"
                                        />
                                        <YAxis
                                            tick={{ fontSize: 11 }}
                                            stroke="var(--text-secondary)"
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'var(--bg-card)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                            }}
                                            labelFormatter={(value) => `記録 #${value}`}
                                        />
                                        <Legend
                                            wrapperStyle={{ fontSize: '12px' }}
                                        />
                                        {IRREVERSIBLE_FIELDS.filter(f => activeFields.has(f.key)).map(field => (
                                            <Line
                                                key={field.key}
                                                type="monotone"
                                                dataKey={field.key}
                                                name={field.label}
                                                stroke={field.color}
                                                strokeWidth={2}
                                                dot={{ r: 4, fill: field.color }}
                                                activeDot={{ r: 6 }}
                                                connectNulls
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-600">
                                <Activity className="w-10 h-10 mb-2 opacity-30" />
                                <p className="text-sm">まだ記録されたデータがありません</p>
                                <p className="text-xs mt-1">内省処理を実行すると記録が蓄積されます</p>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* 感情データ（Lv3-2）グラフセクション */}
                {!isLoading && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.2 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm"
                    >
                        <div className="flex items-center gap-2 mb-4">
                            <TrendingUp className="w-5 h-5 text-amber-500" />
                            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
                                感情・状態データ (Lv3-2)
                            </h3>
                        </div>
                        <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
                            気分・信頼度・健康・友好度など、対話を通じて変化する感情指標
                        </p>

                        {/* フィールドフィルター */}
                        <div className="flex flex-wrap gap-2 mb-6">
                            {EMOTION_FIELDS.map(field => (
                                <button
                                    key={field.key}
                                    onClick={() => toggleEmotionField(field.key)}
                                    className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all duration-200 border ${
                                        activeEmotionFields.has(field.key)
                                            ? 'text-white shadow-sm'
                                            : 'bg-transparent text-slate-500 dark:text-slate-400 border-slate-300 dark:border-slate-700 hover:border-slate-400'
                                    }`}
                                    style={
                                        activeEmotionFields.has(field.key)
                                            ? { backgroundColor: field.color, borderColor: field.color }
                                            : {}
                                    }
                                >
                                    {field.label}
                                </button>
                            ))}
                        </div>

                        {/* グラフ本体 */}
                        {semiquantityData.length > 0 ? (
                            <div className="h-[300px]">
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={formatEmotionChartData()}>
                                        <CartesianGrid strokeDasharray="3 3" stroke="var(--border-color)" />
                                        <XAxis
                                            dataKey="index"
                                            label={{ value: '記録回数', position: 'insideBottomRight', offset: -5, fontSize: 12 }}
                                            tick={{ fontSize: 11 }}
                                            stroke="var(--text-secondary)"
                                        />
                                        <YAxis
                                            tick={{ fontSize: 11 }}
                                            stroke="var(--text-secondary)"
                                            domain={[0, 100]}
                                        />
                                        <Tooltip
                                            contentStyle={{
                                                backgroundColor: 'var(--bg-card)',
                                                border: '1px solid var(--border-color)',
                                                borderRadius: '12px',
                                                fontSize: '12px',
                                                boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
                                            }}
                                            labelFormatter={(value) => `記録 #${value}`}
                                        />
                                        <Legend
                                            wrapperStyle={{ fontSize: '12px' }}
                                        />
                                        {EMOTION_FIELDS.filter(f => activeEmotionFields.has(f.key)).map(field => (
                                            <Line
                                                key={field.key}
                                                type="monotone"
                                                dataKey={field.key}
                                                name={field.label}
                                                stroke={field.color}
                                                strokeWidth={2}
                                                dot={{ r: 4, fill: field.color }}
                                                activeDot={{ r: 6 }}
                                                connectNulls
                                            />
                                        ))}
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center py-12 text-slate-400 dark:text-slate-600">
                                <Activity className="w-10 h-10 mb-2 opacity-30" />
                                <p className="text-sm">まだ記録されたデータがありません</p>
                                <p className="text-xs mt-1">内省処理を実行すると感情データが蓄積されます</p>
                            </div>
                        )}
                    </motion.div>
                )}

                {/* データ概要テーブル */}
                {!isLoading && irreversibleData.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3 }}
                        className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm"
                    >
                        <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100 mb-4">
                            記録一覧
                        </h3>
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="border-b border-slate-200 dark:border-slate-700">
                                        <th className="text-left py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">#</th>
                                        <th className="text-left py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">日時</th>
                                        {IRREVERSIBLE_FIELDS.map(f => (
                                            <th key={f.key} className="text-right py-2 px-3 text-slate-500 dark:text-slate-400 font-medium">
                                                {f.label}
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {irreversibleData.map((record, index) => (
                                        <tr
                                            key={record.id}
                                            className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
                                        >
                                            <td className="py-2 px-3 text-slate-600 dark:text-slate-300">{index + 1}</td>
                                            <td className="py-2 px-3 text-slate-600 dark:text-slate-300">
                                                {new Date(record.recordedAt).toLocaleString('ja-JP', {
                                                    year: 'numeric',
                                                    month: '2-digit',
                                                    day: '2-digit',
                                                    hour: '2-digit',
                                                    minute: '2-digit',
                                                })}
                                            </td>
                                            <td className="text-right py-2 px-3 text-slate-700 dark:text-slate-200 font-mono">
                                                {record.height ?? '-'}
                                            </td>
                                            <td className="text-right py-2 px-3 text-slate-700 dark:text-slate-200 font-mono">
                                                {record.boneDensity ?? '-'}
                                            </td>
                                            <td className="text-right py-2 px-3 text-slate-700 dark:text-slate-200 font-mono">
                                                {record.gripStrength ?? '-'}
                                            </td>
                                            <td className="text-right py-2 px-3 text-slate-700 dark:text-slate-200 font-mono">
                                                {record.voicePitch ?? '-'}
                                            </td>
                                            <td className="text-right py-2 px-3 text-slate-700 dark:text-slate-200 font-mono">
                                                {record.eyesight ?? '-'}
                                            </td>
                                            <td className="text-right py-2 px-3 text-slate-700 dark:text-slate-200 font-mono">
                                                {record.hearingAbility ?? '-'}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}
            </div>
        </div>
    );
}
