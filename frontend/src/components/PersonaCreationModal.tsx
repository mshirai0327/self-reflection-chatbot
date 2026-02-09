import { useState } from 'react';
import axios from 'axios';
import { X, User, Activity, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';

interface PersonaCreationModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCreated: (newPersonaId: string) => void;
}

export function PersonaCreationModal({ isOpen, onClose, onCreated }: PersonaCreationModalProps) {
    const [step, setStep] = useState(1);
    const [isLoading, setIsLoading] = useState(false);

    // Form Data
    const [name, setName] = useState('');
    const [gender, setGender] = useState('Female');
    const [birthDate, setBirthDate] = useState('2024-01-01');
    const [intelligence, setIntelligence] = useState(100);
    
    // Personality
    const [personality, setPersonality] = useState({
        ethics: 50,
        passion: 50,
        curiosity: 50,
        aggressiveness: 50,
        extroversion: 50
    });

    // Vital
    const [vitalData, setVitalData] = useState({
        height: 160,
        weight: 50
    });

    const resetForm = () => {
        setName('');
        setGender('Female');
        setBirthDate('2024-01-01');
        setIntelligence(100);
        setPersonality({ ethics: 50, passion: 50, curiosity: 50, aggressiveness: 50, extroversion: 50 });
        setVitalData({ height: 160, weight: 50 });
        setStep(1);
    };

    const handleClose = () => {
        resetForm();
        onClose();
    };

    const handleSubmit = async () => {
        if (!name.trim()) {
            toast.error('名前を入力してください');
            return;
        }

        setIsLoading(true);
        try {
            const payload = {
                name,
                gender,
                birthDate,
                intelligence,
                personality,
                vitalData
            };
            const res = await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/personas`, payload);
            toast.success('新しいペルソナを作成しました！');
            onCreated(res.data.id);
            handleClose();
        } catch (error) {
            console.error(error);
            toast.error('ペルソナの作成に失敗しました');
        } finally {
            setIsLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 dark:border-slate-800 flex flex-col max-h-[90vh]">
                
                {/* Header */}
                <div className="px-6 py-4 border-b border-slate-100 dark:border-slate-800 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50">
                    <h2 className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
                        <User className="w-5 h-5 text-blue-500" />
                        新規ペルソナ作成
                    </h2>
                    <button onClick={handleClose} className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-full transition-colors text-slate-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <div className="p-6 overflow-y-auto">
                    {step === 1 && (
                        <div className="space-y-4 animate-in fade-in slide-in-from-right-4 duration-300">
                            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 flex items-center justify-center text-xs">1</span>
                                基本情報
                            </h3>
                            
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">名前 <span className="text-red-500">*</span></label>
                                <input 
                                    type="text" 
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="例: Reflecta"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">性別</label>
                                    <select 
                                        value={gender}
                                        onChange={(e) => setGender(e.target.value)}
                                        className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    >
                                        <option value="Female">Female</option>
                                        <option value="Male">Male</option>
                                        <option value="Non-binary">Non-binary</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">誕生日</label>
                                    <input 
                                        type="date" 
                                        value={birthDate}
                                        onChange={(e) => setBirthDate(e.target.value)}
                                        className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 outline-none text-sm"
                                    />
                                </div>
                            </div>
                            
                            <div>
                                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">知能指数 (IQ)</label>
                                <input 
                                    type="number" 
                                    value={intelligence}
                                    onChange={(e) => setIntelligence(Number(e.target.value))}
                                    className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded focus:ring-2 focus:ring-blue-500 outline-none"
                                />
                            </div>

                            <div>
                                <h4 className="text-xs font-bold text-slate-400 mt-4 mb-2 flex items-center gap-1"><Activity className="w-3 h-3"/> 身体的特徴</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div>
                                        <label className="block text-[10px] text-slate-500 mb-1">身長 (cm)</label>
                                        <input 
                                            type="number" 
                                            value={vitalData.height}
                                            onChange={(e) => setVitalData({...vitalData, height: Number(e.target.value)})}
                                            className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded outline-none text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] text-slate-500 mb-1">体重 (kg)</label>
                                        <input 
                                            type="number" 
                                            value={vitalData.weight}
                                            onChange={(e) => setVitalData({...vitalData, weight: Number(e.target.value)})}
                                            className="w-full p-2 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded outline-none text-sm"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {step === 2 && (
                        <div className="space-y-5 animate-in fade-in slide-in-from-right-4 duration-300">
                             <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-2 flex items-center gap-2">
                                <span className="w-6 h-6 rounded-full bg-purple-100 dark:bg-purple-900 text-purple-600 dark:text-purple-300 flex items-center justify-center text-xs">2</span>
                                性格パラメータ (0-100)
                            </h3>

                            <div className="space-y-4">
                                {Object.entries(personality).map(([key, val]) => (
                                    <div key={key}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="capitalize text-slate-700 dark:text-slate-300">{key}</span>
                                            <span className="text-slate-500">{val}</span>
                                        </div>
                                        <input 
                                            type="range" 
                                            min="0" max="100" 
                                            value={val}
                                            onChange={(e) => setPersonality({...personality, [key]: Number(e.target.value)})}
                                            className="w-full h-2 bg-slate-200 dark:bg-slate-700 rounded-lg appearance-none cursor-pointer accent-purple-600"
                                        />
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/50 flex justify-end gap-3">
                    {step === 2 ? (
                        <>
                             <button 
                                onClick={() => setStep(1)}
                                disabled={isLoading}
                                className="px-4 py-2 text-sm text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200"
                            >
                                戻る
                            </button>
                            <button 
                                onClick={handleSubmit}
                                disabled={isLoading}
                                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium shadow-lg shadow-blue-500/20 disabled:opacity-50 flex items-center gap-2"
                            >
                                {isLoading ? '作成中...' : (
                                    <>
                                        <Sparkles className="w-4 h-4" />
                                        作成する
                                    </>
                                )}
                            </button>
                        </>
                    ) : (
                        <button 
                            onClick={() => setStep(2)}
                            className="px-6 py-2 bg-slate-900 dark:bg-slate-700 hover:bg-slate-800 dark:hover:bg-slate-600 text-white rounded-lg text-sm font-medium transition-colors"
                        >
                            次へ
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
