/**
 * 環境判定・設定ユーティリティ
 *
 * 開発環境と本番環境で異なる挙動を制御するためのヘルパー関数群です。
 * 環境変数 NODE_ENV と各種フラグを用いて、機能の有効/無効を切り替えます。
 */

/**
 * 現在の環境が本番環境かどうかを判定します。
 * @returns 本番環境の場合 true
 */
export function isProduction(): boolean {
    return process.env.NODE_ENV === "production";
}

/**
 * 現在の環境が開発環境かどうかを判定します。
 * @returns 開発環境の場合 true
 */
export function isDevelopment(): boolean {
    return process.env.NODE_ENV !== "production";
}

/**
 * Local LLM プロキシAPI（/api/llm/models, /api/llm/test）が有効かどうかを判定します。
 *
 * SSRF対策として、本番環境ではデフォルトで無効になります。
 * 環境変数 ENABLE_LOCAL_LLM_PROXY で明示的に制御できます。
 *
 * @returns Local LLM プロキシが有効な場合 true
 */
export function isLocalLLMProxyEnabled(): boolean {
    const envFlag = process.env.ENABLE_LOCAL_LLM_PROXY;
    if (envFlag !== undefined) {
        return envFlag === "true";
    }
    // 環境変数が未設定の場合: 開発環境なら有効、本番なら無効
    return isDevelopment();
}

/**
 * 指定されたLLMプロバイダーが現在の環境で利用可能かどうかを判定します。
 *
 * 本番環境ではSSRF対策として "local" プロバイダー（任意のエンドポイントへのプロキシ）は無効です。
 *
 * @param provider - 判定するプロバイダー名
 * @returns 利用可能な場合 true
 */
export function isProviderAllowed(provider: string): boolean {
    if (provider === "local") {
        return isLocalLLMProxyEnabled();
    }
    // gemini, openai は常に許可
    return true;
}
