import React, { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { Send, Menu, ChevronLeft, Database, Sun, Moon, MessageSquare, BarChart3, ArrowDown, Network } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import toast, { Toaster } from 'react-hot-toast';
import { BotSidebar } from './components/BotSidebar';
import { ChatHistory } from './components/ChatHistory';
import { PersonaCreationModal } from './components/PersonaCreationModal';
import { PersonaSelector } from './components/PersonaSelector';
import { PersonaLogTab } from './components/PersonaLogTab';
import { GraphViewer } from './components/GraphViewer';
import { GroupChatCreationModal } from './components/GroupChatCreationModal';
import { handleApiError } from './utils/errorHandler';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  /** メッセージの送信日時 */
  createdAt?: string;
  /** 話しているペルソナの名前 */
  name?: string;
}

interface Persona {
  id: string;
  name: string;
}

interface PersonaStatus {
  // Lv1 & Lv2 (Immutable/Semi-immutable)
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

  // Physical (Variable)
  height: number;
  weight: number;
  boneDensity?: number;
  gripStrength?: number;
  voicePitch?: number;
  eyesight?: number;
  hearingAbility?: number;
  bloodSugar?: number;
  bloodPressureSys?: number;
  bloodPressureDia?: number;
  sleepTime?: number;
  sleepQuality?: number;

  // Status (Volatile)
  health: number;
  mood: number;
  trust: number;
  friendliness?: number;
}

export interface DebugInfo {
  systemPrompt: string;
  userPrompt: string;
  contextMemories: { content: string | null; distance: number | null }[];
}

/**
 * 内省処理のレスポンス内容を格納するインターフェース
 */
interface ReflectionResponse {
  thought: string;
  statusUpdate: {
    health: number;
    mood: number;
    trust: number;
    friendliness: number;
  };
  permanentMemory?: string;
  newMemories?: string[];
}

/**
 * 内省結果全体を表すインターフェース
 * ChatHistory.tsxと同じ構造を保つ
 */
export interface ReflectionResult {
  id: string;
  prompt?: string;
  createdAt?: string;
  response: ReflectionResponse;
}

const API_URL = import.meta.env.VITE_API_URL || '';

/**
 * 日付ラベルを生成するヘルパー関数
 * 今日・昨日は相対表示、それ以外は「YYYY年M月D日」形式
 */
const getDateLabel = (dateStr: string): string => {
  const date = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return '今日';
  if (date.toDateString() === yesterday.toDateString()) return '昨日';

  return date.toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
};

function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isReflecting, setIsReflecting] = useState(false);
  const [status, setStatus] = useState<PersonaStatus>({
    height: 160,
    weight: 50,
    health: 100,
    mood: 50,
    trust: 50
  });
  const [lastDebugInfo, setLastDebugInfo] = useState<DebugInfo | null>(null);
  const [lastReflection, setLastReflection] = useState<ReflectionResult | null>(null);

  const [isLeftOpen, setIsLeftOpen] = useState(true);
  const [isRightOpen, setIsRightOpen] = useState(true);
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [chatModel, setChatModel] = useState<string>(() => localStorage.getItem('chatModel') || 'gemini-2.5-flash');
  const [reflectModel, setReflectModel] = useState<string>(() => localStorage.getItem('reflectModel') || 'gemini-2.5-pro');
  const [llmSettings, setLlmSettings] = useState(() => {
    const saved = localStorage.getItem('llmSettings');
    const defaultSettings = {
      provider: 'gemini' as 'gemini' | 'local',
      localEndpoint: 'http://localhost:11434/v1',
      localChatModel: 'llama3',
      localReflectModel: 'llama3',
      availableModels: [] as string[]
    };
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Migration for old settings
        if (parsed.localModel && !parsed.localChatModel) {
          parsed.localChatModel = parsed.localModel;
          parsed.localReflectModel = parsed.localModel;
          delete parsed.localModel;
        }
        return { ...defaultSettings, ...parsed };
      } catch (e) {
        console.error('Failed to parse llmSettings from localStorage', e);
        localStorage.removeItem('llmSettings');
        return defaultSettings;
      }
    }
    return defaultSettings;
  });
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  /** ページネーション用ステート */
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  /** スクロール位置が最下部付近にいるか（フローティングボタン表示判定用） */
  const [isNearBottom, setIsNearBottom] = useState(true);

  /** メインエリアのタブ状態: 'chat' | 'persona-log' | 'graph' */
  const [activeTab, setActiveTab] = useState<'chat' | 'persona-log' | 'graph'>('chat');

  /** 内省頻度制限のためのステート */
  const [userMessageCountSinceLastReflection, setUserMessageCountSinceLastReflection] = useState<number>(0);
  const REQUIRED_TURNS = 5;

  // Load state from localStorage
  const [currentPersonaId, setCurrentPersonaId] = useState<string | null>(() => localStorage.getItem('currentPersonaId'));
  // currentChatId also needs to be persisted to restore session
  const [currentChatId, setCurrentChatId] = useState<string | null>(() => localStorage.getItem('currentChatId'));
  /** グループチャットの選択中ID（1:1チャットと排他） */
  const [currentGroupChatId, setCurrentGroupChatId] = useState<string | null>(null);

  const [personas, setPersonas] = useState<Persona[]>([]);
  const [isPersonaModalOpen, setIsPersonaModalOpen] = useState(false);
  const [isGroupChatModalOpen, setIsGroupChatModalOpen] = useState(false);

  // Persist state
  useEffect(() => {
    if (currentPersonaId) {
        localStorage.setItem('currentPersonaId', currentPersonaId);
    } else {
        localStorage.removeItem('currentPersonaId');
    }
  }, [currentPersonaId]);

  useEffect(() => {
    if (currentChatId) {
        localStorage.setItem('currentChatId', currentChatId);
    } else {
        localStorage.removeItem('currentChatId');
    }
  }, [currentChatId]);

  // 設定の永続化
  useEffect(() => {
    localStorage.setItem('chatModel', chatModel);
  }, [chatModel]);

  useEffect(() => {
    localStorage.setItem('reflectModel', reflectModel);
  }, [reflectModel]);

  useEffect(() => {
    localStorage.setItem('llmSettings', JSON.stringify(llmSettings));
  }, [llmSettings]);

  // ダークモードのクラス切り替え
  useEffect(() => {
    console.log('Dark mode changed:', isDarkMode);
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  // 初回読み込み: ペルソナ一覧取得
  const fetchPersonas = async (options: { skipAutoSelect?: boolean } = {}) => {
    try {
      const res = await axios.get(`${API_URL}/api/personas`);
      setPersonas(res.data);
      
      // 未選択、または選択中のペルソナが一覧に存在しない場合は最初のペルソナを選択
      if (!options.skipAutoSelect && res.data.length > 0) {
        const currentExists = currentPersonaId && res.data.some((p: Persona) => p.id === currentPersonaId);
        if (!currentExists) {
            console.log('Selected persona not found in current list, resetting to default.');
            setCurrentPersonaId(res.data[0].id);
            // ペルソナが変わった（無効だった）ので、紐づくチャットもリセット
            setCurrentChatId(null);
        }
      }
    } catch (error) {
      console.error('Failed to fetch personas:', error);
    }
  };

  useEffect(() => {
    fetchPersonas();
  }, []);

  // ペルソナのステータスを取得する関数
  const fetchPersonaStatus = async () => {
      if (!currentPersonaId) return;
      try {
          const res = await axios.get(`${API_URL}/api/personas/${currentPersonaId}`);
          if (res.data) {
              setStatus(res.data);
          }
      } catch (error) {
          console.error('Failed to fetch persona status:', error);
      }
  };

  // ペルソナ変更時にステータスを取得
  useEffect(() => {
    fetchPersonaStatus();
  }, [currentPersonaId]);

  // 初回読み込み時に最新のチャットを自動選択 (PersonaId依存に変更)
  useEffect(() => {
    const fetchInitialChat = async () => {
        // If we already have a chatId (from localStorage), don't override it with latest
        if (currentChatId) return;

      try {
        console.log('[App] Fetching initial chats from:', `${API_URL}/api/chats`);
        const res = await axios.get(`${API_URL}/api/chats`, { params: { personaId: currentPersonaId } });
        console.log('[App] Chats received:', res.data);
        if (res.data && res.data.length > 0) {
          const latestChatId = res.data[0].id;
          console.log('[App] Automatically selecting latest chat:', latestChatId);
          setCurrentChatId(latestChatId);
        } else {
          console.log('[App] No existing chats found.');
        }
      } catch (error) {
        console.error('[App] Failed to fetch initial chats:', error);
      }
    };
    if (currentPersonaId) {
        fetchInitialChat();
    }
  }, [currentPersonaId]); // PersonaIdが変わったらチャット一覧も再取得 (useEffect依存配列変更)

  useEffect(() => {
    const fetchChatSession = async () => {
      if (!currentChatId) {
        console.log('[App] No currentChatId, clearing messages.');
        setMessages([]);
        setNextCursor(null);
        setHasMore(false);
        return;
      }
      try {
        console.log('[App] Fetching logs for chat:', currentChatId);
        const res = await axios.get(`${API_URL}/api/chats/${currentChatId}`);
        const history = res.data.chatLogs.map((log: any) => ({
          role: log.role as 'user' | 'assistant',
          content: log.content,
          createdAt: log.createdAt,
          name: log.persona?.name
        }));
        setMessages(history);
        setNextCursor(res.data.nextCursor || null);
        setHasMore(res.data.hasMore || false);

        // 内省結果があればセット
        if (res.data.latestReflection) {
          console.log('[App] Found previous reflection:', res.data.latestReflection);
          setLastReflection(res.data.latestReflection);
        } else {
          setLastReflection(null);
        }

        if (typeof res.data.userMessageCountSinceLastReflection === 'number') {
            setUserMessageCountSinceLastReflection(res.data.userMessageCountSinceLastReflection);
        } else {
            setUserMessageCountSinceLastReflection(0);
        }

        // ステータスがあればセット (初回ロード時など)
        if (res.data.status) {
          console.log('[App] Setting initial status:', res.data.status);
          setStatus(res.data.status);
        }
      } catch (error) {
        console.error('[App] Failed to fetch chat logs:', error);
      }
    };
    fetchChatSession();
  }, [currentChatId]);

  /**
   * 古いメッセージを追加取得する（上方向スクロール時に呼ばれる）
   * スクロール位置を古いメッセージ挿入後も維持するため、
   * 挿入前のscrollHeightを記録し、挿入後に差分だけスクロール位置を補正する
   */
  const fetchOlderMessages = useCallback(async () => {
    if (!currentChatId || !nextCursor || isLoadingMore || !hasMore) return;
    setIsLoadingMore(true);
    try {
      const scrollEl = scrollRef.current;
      const prevScrollHeight = scrollEl?.scrollHeight || 0;

      const res = await axios.get(`${API_URL}/api/chats/${currentChatId}`, {
        params: { cursor: nextCursor }
      });
      const olderMessages: Message[] = res.data.chatLogs.map((log: any) => ({
        role: log.role as 'user' | 'assistant',
        content: log.content,
        createdAt: log.createdAt
      }));

      if (olderMessages.length > 0) {
        setMessages(prev => [...olderMessages, ...prev]);
        setNextCursor(res.data.nextCursor || null);
        setHasMore(res.data.hasMore || false);

        // スクロール位置を維持する（次のレンダリング後に補正）
        requestAnimationFrame(() => {
          if (scrollEl) {
            const newScrollHeight = scrollEl.scrollHeight;
            scrollEl.scrollTop = newScrollHeight - prevScrollHeight;
          }
        });
      } else {
        setHasMore(false);
      }
    } catch (error) {
      console.error('[App] Failed to fetch older messages:', error);
    } finally {
      setIsLoadingMore(false);
    }
  }, [currentChatId, nextCursor, isLoadingMore, hasMore]);

  /**
   * 現在のスクロール位置が最下部付近かチェックする
   */
  const checkScrollPosition = useCallback(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;
    const distanceFromBottom = scrollEl.scrollHeight - scrollEl.scrollTop - scrollEl.clientHeight;
    setIsNearBottom(distanceFromBottom < 150);
  }, []);

  /**
   * 最下部へスムーズスクロールする
   */
  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
      // スクロール開始後に判定を更新
      setTimeout(checkScrollPosition, 500);
    }
  }, [checkScrollPosition]);

  /**
   * スクロールイベントハンドラ
   * - 上方向スクロール検知：古いメッセージを取得
   * - 最下部判定：フローティングボタン表示用
   */
  useEffect(() => {
    const scrollEl = scrollRef.current;
    if (!scrollEl) return;

    const handleScroll = () => {
      // スクロール位置が上部100px以内に来たら追加取得
      if (scrollEl.scrollTop < 100 && hasMore && !isLoadingMore) {
        fetchOlderMessages();
      }
      checkScrollPosition();
    };

    scrollEl.addEventListener('scroll', handleScroll);
    return () => scrollEl.removeEventListener('scroll', handleScroll);
  }, [hasMore, isLoadingMore, fetchOlderMessages, checkScrollPosition]);

  /** メッセージが追加・更新された場合のスクロール制御 */
  const prevMessageCountRef = useRef(0);
  useEffect(() => {
    // メッセージ数が増えた場合（新規送信や初回ロード）の制御
    if (messages.length > 0 && scrollRef.current) {
      if (prevMessageCountRef.current === 0) {
        // 初回ロード時は最下部へ
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      } else if (messages.length > prevMessageCountRef.current) {
        // 新規メッセージ追加時
        const isOlderMessageLoad = messages.length - prevMessageCountRef.current > 2;
        if (!isOlderMessageLoad) {
          // 自分が送った、あるいは返信がきた場合は最下部へ
          scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
      }
      // メッセージ更新後にスクロール位置を再判定
      setTimeout(checkScrollPosition, 100);
    }
    prevMessageCountRef.current = messages.length;
  }, [messages, checkScrollPosition]);

  /** タブ切り替え時にスクロール位置を再チェック */
  useEffect(() => {
    if (activeTab === 'chat') {
      setTimeout(checkScrollPosition, 100);
    }
  }, [activeTab, checkScrollPosition]);

  const handleSend = async () => {
    if (!input.trim() || isLoading) return;

    const userMsg: Message = { role: 'user', content: input, createdAt: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setIsLoading(true);

    // テキストエリアの高さをリセット
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
    }

    try {
      const llmConfig = {
        provider: llmSettings.provider,
        model: llmSettings.provider === 'local' ? llmSettings.localChatModel : chatModel,
        endpoint: llmSettings.provider === 'local' ? llmSettings.localEndpoint : undefined
      };

      const res = await axios.post(`${API_URL}/api/chat`, {
        message: input,
        llmConfig,
        chatId: currentChatId,
        personaId: currentPersonaId // Send selected persona
      });

      // 新規チャット作成時の処理
      if (!currentChatId && res.data.chatId) {
        setCurrentChatId(res.data.chatId);
      }
      setUserMessageCountSinceLastReflection(prev => prev + 1);
      const aiMsg: Message = { role: 'assistant', content: res.data.response, createdAt: new Date().toISOString(), name: res.data.name };
      setMessages(prev => [...prev, aiMsg]);
      if (res.data.status) setStatus(res.data.status);
      if (res.data.debug) setLastDebugInfo(res.data.debug);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      handleApiError(error, 'メッセージの送信に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReflect = async () => {
    if (!currentChatId) {
      toast.error('内省を行うには、まずチャットを開始してください');
      return;
    }

    setIsReflecting(true);
    try {
      const llmConfig = {
        provider: llmSettings.provider,
        model: llmSettings.provider === 'local' ? llmSettings.localReflectModel : reflectModel,
        endpoint: llmSettings.provider === 'local' ? llmSettings.localEndpoint : undefined
      };

      const res = await axios.post(`${API_URL}/api/reflect`, {
        llmConfig,
        chatId: currentChatId
      });
      toast.success('内省が完了しました', {
        duration: 3000,
        style: {
          background: '#10B981', // Emerald 500
          color: '#fff',
        },
        iconTheme: {
          primary: '#fff',
          secondary: '#10B981',
        },
      });
      setLastReflection({
        id: 'temp-id',
        createdAt: new Date().toISOString(),
        response: res.data.reflection
      });
      setUserMessageCountSinceLastReflection(0);

      const followUpMessage = "内省が終わったようですね。今の気分はどうですか？";
      setMessages(prev => [...prev, { role: 'user', content: followUpMessage, createdAt: new Date().toISOString() }]);

      const resChat = await axios.post(`${API_URL}/api/chat`, {
        message: followUpMessage,
        llmConfig,
        chatId: currentChatId,
        personaId: currentPersonaId
      });
      setMessages(prev => [...prev, { role: 'assistant', content: resChat.data.response, createdAt: new Date().toISOString(), name: resChat.data.name }]);
      if (resChat.data.status) setStatus(resChat.data.status);
      setRefreshTrigger(prev => prev + 1);
    } catch (error) {
      handleApiError(error, '内省処理に失敗しました');
    } finally {
      setIsReflecting(false);
    }
  };

  return (
    <div className="flex flex-col h-screen w-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 overflow-hidden font-sans transition-colors duration-300 relative">
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3000,
          error: {
            duration: 4000,
          },
        }}
      />

      {/* Fixed Header */}
      <header className="h-16 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between px-4 bg-white/80 dark:bg-slate-900/80 backdrop-blur-md z-40 transition-colors duration-300 shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsLeftOpen(!isLeftOpen)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title={isLeftOpen ? "サイドバーを閉じる" : "サイドバーを開く"}
          >
            <Menu className="w-5 h-5 text-slate-600 dark:text-slate-400" />
          </button>
          <h1 className="text-lg font-bold text-slate-800 dark:text-slate-100 ml-2">Reflecta Chat</h1>
          
          {/* Persona Selector */}
          <PersonaSelector
            personas={personas}
            currentPersonaId={currentPersonaId}
            onSelect={(personaId) => {
              setCurrentPersonaId(personaId);
              setCurrentChatId(null);
              setMessages([]); // ペルソナ切り替え時にメッセージをクリア
            }}
            onCreateNew={() => setIsPersonaModalOpen(true)}
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsDarkMode(!isDarkMode)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title={isDarkMode ? "ライトモードに切り替え" : "ダークモードに切り替え"}
          >
            {isDarkMode ? <Sun className="w-5 h-5 text-amber-400" /> : <Moon className="w-5 h-5 text-slate-600" />}
          </button>
          <button
            onClick={() => setIsRightOpen(!isRightOpen)}
            className="p-2 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
            title={isRightOpen ? "チャットログを閉じる" : "チャットログを開く"}
          >
            <ChevronLeft className={`w-5 h-5 text-slate-600 dark:text-slate-400 transition-transform duration-300 ${isRightOpen ? 'rotate-180' : ''}`} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex-1 flex overflow-hidden relative">
        {/* Bot Sidebar (Left) */}
        <BotSidebar
          isOpen={isLeftOpen}
          status={status}
          lastDebugInfo={lastDebugInfo}
          onStatusRefresh={fetchPersonaStatus}
        />

        {/* Main Chat Area */}
        <main className="flex-1 flex flex-col relative bg-slate-50 dark:bg-slate-950 min-w-0">

          {/* タブ切り替え (#38: メインディスプレイのタブ分割) */}
          <div className="flex items-center border-b border-slate-200 dark:border-slate-800 bg-white/50 dark:bg-slate-900/50 backdrop-blur-sm px-4 shrink-0">
            <button
              onClick={() => setActiveTab('chat')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 ${
                activeTab === 'chat'
                  ? 'border-blue-500 text-blue-600 dark:text-blue-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <MessageSquare className="w-4 h-4" />
              Chat
            </button>
            <button
              onClick={() => setActiveTab('graph')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 ${
                activeTab === 'graph'
                  ? 'border-green-500 text-green-600 dark:text-green-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <Network className="w-4 h-4" />
              知識グラフ
            </button>
            <button
              onClick={() => setActiveTab('persona-log')}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-all duration-200 ${
                activeTab === 'persona-log'
                  ? 'border-indigo-500 text-indigo-600 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-300 hover:border-slate-300 dark:hover:border-slate-600'
              }`}
            >
              <BarChart3 className="w-4 h-4" />
              人格ログ
            </button>
          </div>

          {/* タブコンテンツ */}
          {activeTab === 'chat' ? (
            <>
              {/* Messages (#14: 時刻表示付き) */}
              <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth scrollbar-hide"
              >
                <div className="w-full max-w-[740px] mx-auto space-y-6">
                  {/* 過去のメッセージ読み込みインジケーター */}
                  {isLoadingMore && (
                    <div className="flex justify-center py-3">
                      <div className="flex items-center gap-2 text-xs text-slate-400 dark:text-slate-500 bg-slate-100 dark:bg-slate-800 px-4 py-2 rounded-full">
                        <span className="w-3 h-3 border-2 border-slate-300 dark:border-slate-600 border-t-blue-500 rounded-full animate-spin" />
                        過去のメッセージを読み込み中...
                      </div>
                    </div>
                  )}
                  {hasMore && !isLoadingMore && (
                    <div className="flex justify-center py-2">
                      <button
                        onClick={fetchOlderMessages}
                        className="text-xs text-slate-400 dark:text-slate-500 hover:text-blue-500 dark:hover:text-blue-400 transition-colors"
                      >
                        ↑ 過去のメッセージを表示
                      </button>
                    </div>
                  )}
                  <AnimatePresence initial={false}>
                    {messages.length === 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-600 space-y-4 py-20"
                      >
                        <Database size={48} className="opacity-10" />
                        <p className="text-lg text-slate-500">対話を開始して、意識を呼び覚ましてください</p>
                      </motion.div>
                    )}
                    {messages.flatMap((m, i) => {
                      const elements: React.ReactNode[] = [];

                      // 日付が変わったタイミングで日付ラベルを挿入
                      const showDateLabel = m.createdAt && (
                        i === 0 ||
                        !messages[i - 1].createdAt ||
                        new Date(m.createdAt).toDateString() !== new Date(messages[i - 1].createdAt!).toDateString()
                      );

                      if (showDateLabel) {
                        elements.push(
                          <div
                            key={`date-${i}`}
                            className="sticky top-0 z-10 flex justify-center py-2"
                          >
                            <span className="text-[11px] font-medium text-slate-500 dark:text-slate-400 bg-slate-100/90 dark:bg-slate-800/90 backdrop-blur-sm px-4 py-1.5 rounded-full shadow-sm border border-slate-200/50 dark:border-slate-700/50">
                              {getDateLabel(m.createdAt!)}
                            </span>
                          </div>
                        );
                      }

                      elements.push(
                        <motion.div
                          key={`msg-${i}`}
                          initial={{ opacity: 0, x: 0, y: 10 }}
                          animate={{ opacity: 1, x: 0, y: 0 }}
                          className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className="flex flex-col gap-1 max-w-[85%]">
                            <div className={`p-4 rounded-2xl shadow-sm transition-colors duration-300 ${m.role === 'user'
                              ? 'bg-blue-600 text-white rounded-br-none'
                              : 'bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 dark:text-slate-100 rounded-bl-none'
                              }`}>
                              <p className="leading-relaxed whitespace-pre-wrap">{m.content}</p>
                            </div>
                            {/* 時刻と名前表示 (#14, 複数ペルソナ対応) */}
                            <div className={`flex items-center gap-2 px-1 text-[10px] text-slate-400 dark:text-slate-500 ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                              {m.role === 'assistant' && m.name && (
                                <span className="font-semibold text-slate-500 dark:text-slate-400">{m.name}</span>
                              )}
                              {m.createdAt && (
                                <span>
                                  {new Date(m.createdAt).toLocaleTimeString('ja-JP', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                  })}
                                </span>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      );

                      return elements;
                    })}
                  </AnimatePresence>
                  {isLoading && (
                    <div className="flex justify-start">
                      <div className="bg-white dark:bg-slate-900 border border-slate-100 dark:border-slate-800 p-4 rounded-2xl rounded-bl-none flex gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" />
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.2s]" />
                        <span className="w-2 h-2 bg-blue-500 rounded-full animate-bounce [animation-delay:0.4s]" />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* フローティングボタン: 最新メッセージへ */}
              <AnimatePresence>
                {!isNearBottom && messages.length > 0 && (
                  <motion.button
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 20, scale: 0.9 }}
                    transition={{ duration: 0.2 }}
                    onClick={scrollToBottom}
                    className="absolute bottom-24 right-8 z-20 flex items-center gap-1.5 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium rounded-full shadow-lg hover:shadow-xl transition-all cursor-pointer"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                    最新のメッセージへ
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Input Area (#24: Shift+Enterで改行対応) */}
              <div className="p-4 pt-0 z-10">
                <div className="w-full max-w-[740px] mx-auto">
                  <div className="flex gap-3 p-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xl focus-within:ring-2 focus-within:ring-blue-500/20 transition-all items-end">
                    <textarea
                      ref={textareaRef}
                      value={input}
                      onChange={(e) => {
                        setInput(e.target.value);
                        // テキストエリアの高さを自動調整
                        const target = e.target;
                        target.style.height = 'auto';
                        target.style.height = Math.min(target.scrollHeight, 160) + 'px';
                      }}
                      onKeyDown={(e) => {
                        // Enterのみで送信、Shift+Enterで改行
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSend();
                        }
                      }}
                      placeholder="何でも話しかけてください... (Shift+Enterで改行)"
                      rows={1}
                      className="flex-1 bg-transparent border-none outline-none px-4 py-2 text-slate-900 dark:text-slate-100 placeholder-slate-400 resize-none overflow-y-auto scrollbar-hide"
                      style={{ maxHeight: '160px' }}
                    />
                    <button
                      onClick={handleSend}
                      disabled={isLoading}
                      className="p-3 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 rounded-xl transition-colors shadow-lg shadow-blue-500/20 text-white shrink-0"
                    >
                      <Send size={20} />
                    </button>
                  </div>
                  <div className="text-center mt-4 mb-2">
                    <button
                      onClick={handleReflect}
                      disabled={isLoading || isReflecting || userMessageCountSinceLastReflection < REQUIRED_TURNS}
                      className="px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 dark:disabled:bg-slate-800 text-white rounded-full shadow-md hover:shadow-lg transition-all duration-300 text-xs font-semibold tracking-wide cursor-pointer disabled:cursor-not-allowed group relative"
                    >
                      {userMessageCountSinceLastReflection < REQUIRED_TURNS ? `内省を実行する (あと${REQUIRED_TURNS - userMessageCountSinceLastReflection}回)` : '内省を実行する'}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : activeTab === 'graph' ? (
             <div className="flex-1 overflow-hidden p-4 bg-slate-900 border-l border-slate-800">
               <GraphViewer />
             </div>
          ) : (
            /* 人格ログタブ (#38) */
            <PersonaLogTab 
              key={`${currentPersonaId}-${refreshTrigger}`} 
              currentPersonaId={currentPersonaId} 
            />
          )}
        </main>

        {/* Chat History Sidebar (Right) */}
        <ChatHistory
          isOpen={isRightOpen}
          refreshTrigger={refreshTrigger}
          onSelectChat={(id: string) => {
            setCurrentChatId(id);
            setCurrentGroupChatId(null); // 1:1選択時にグループを解除
          }}
          onSelectGroupChat={(id: string) => {
            setCurrentGroupChatId(id);
            setCurrentChatId(null); // グループ選択時に1:1を解除
          }}
          currentChatId={currentChatId}
          currentGroupChatId={currentGroupChatId}
          currentPersonaId={currentPersonaId}
          personas={personas}
          onNewChat={() => setCurrentChatId(null)}
          onNewGroupChat={() => setIsGroupChatModalOpen(true)}
          chatModel={chatModel}
          setChatModel={setChatModel}
          reflectModel={reflectModel}
          setReflectModel={setReflectModel}
          llmSettings={llmSettings}
          setLlmSettings={setLlmSettings}
          lastReflection={lastReflection}
        />

        <PersonaCreationModal 
          isOpen={isPersonaModalOpen}
          onClose={() => setIsPersonaModalOpen(false)}
          onCreated={async (newPersonaId) => {
            await fetchPersonas({ skipAutoSelect: true });
            setCurrentPersonaId(newPersonaId);
            setCurrentChatId(null);
            setCurrentGroupChatId(null);
            setMessages([]);
            setStatus(prev => ({ ...prev, name: undefined }));
          }}
        />

        <GroupChatCreationModal
          isOpen={isGroupChatModalOpen}
          onClose={() => setIsGroupChatModalOpen(false)}
          onCreate={async (title, personaIds) => {
            try {
              const res = await axios.post(`${API_URL}/api/group-chats`, { title, personaIds });
              setCurrentGroupChatId(res.data.id);
              setCurrentChatId(null);
              setRefreshTrigger(prev => prev + 1);
              toast.success('グループチャットを作成しました');
            } catch (error) {
              handleApiError(error, 'グループチャットの作成に失敗しました');
            }
          }}
          personas={personas}
        />
      </div>

      {/* 画面全体を覆う内省用ローディングオーバーレイ */}
      <AnimatePresence>
        {isReflecting && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm"
          >
            <div className="flex flex-col items-center gap-4 p-8 bg-white/10 dark:bg-slate-900/40 rounded-3xl shadow-2xl border border-white/20 dark:border-slate-800/50 backdrop-blur-md">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-indigo-500/30 rounded-full animate-pulse blur-sm absolute inset-0"></div>
                <div className="w-16 h-16 border-4 border-slate-200 dark:border-slate-700 border-t-indigo-500 rounded-full animate-spin relative z-10"></div>
              </div>
              <p className="text-lg font-medium tracking-wider text-slate-800 dark:text-slate-100 mt-2">
                人格再構築システムによる内省処理が進行中です
              </p>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                この処理には数十秒かかる場合があります
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default App;