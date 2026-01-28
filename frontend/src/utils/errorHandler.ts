import { AxiosError } from 'axios';
import toast from 'react-hot-toast';

/**
 * APIエラーをハンドリングしてトースト通知を表示する関数
 * @param error 発生したエラーオブジェクト
 * @param defaultMessage デフォルトのエラーメッセージ
 */
export const handleApiError = (error: unknown, defaultMessage: string = 'エラーが発生しました') => {
    if (error instanceof AxiosError) {
        if (error.response) {
            // サーバーからのレスポンスがある場合
            const status = error.response.status;
            const data = error.response.data as { error?: string };
            const serverMessage = data?.error || '';

            console.error(`[API Error] Status: ${status}, Message: ${serverMessage}`);

            switch (status) {
                case 400:
                    toast.error(`リクエストが不正です。\n${serverMessage}`);
                    break;
                case 401:
                    toast.error('認証に失敗しました。再ログインやAPIキーの確認が必要です。');
                    break;
                case 403:
                    toast.error('アクセス権限がありません。');
                    break;
                case 404:
                    toast.error('リソースが見つかりませんでした。');
                    break;
                case 429:
                    toast.error('リクエスト回数が多すぎます。しばらく時間を置いてから再度お試しください。');
                    break;
                case 500:
                    toast.error(`システムエラーが発生しました。\n${serverMessage}`);
                    break;
                case 503:
                    toast.error('サービスが一時的に利用できません。メンテナンス中か過負荷の可能性があります。');
                    break;
                default:
                    toast.error(`エラー (${status}): ${serverMessage || defaultMessage}`);
            }
        } else if (error.request) {
            // リクエストは送信されたがレスポンスがない場合
            toast.error('サーバーからの応答がありません。ネットワーク接続を確認してください。');
        } else {
            // リクエスト設定時にエラーが発生した場合
            toast.error(`通信エラー: ${error.message}`);
        }
    } else {
        // Axios以外のエラー
        console.error('Unexpected error:', error);
        toast.error(defaultMessage);
    }
};
