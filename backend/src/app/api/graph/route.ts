import { NextResponse } from "next/server";
export const dynamic = 'force-dynamic';

/** タイムアウトのミリ秒数 */
const FETCH_TIMEOUT_MS = 10_000;

/**
 * LLMサービスからグラフデータを取得するAPIエンドポイント。
 *
 * @remarks
 * 環境変数 `LLM_SERVICE_URL` に設定されたURLの `/graph` エンドポイントへ
 * GETリクエストを送信し、レスポンスをそのままクライアントへ返します。
 * ネットワーク障害やサービス応答遅延によるハングを防ぐため、
 * {@link FETCH_TIMEOUT_MS} ミリ秒でリクエストを強制中断します。
 *
 * @returns グラフデータを含む JSON レスポンス。
 *   - 成功時: LLMサービスから受け取った `data` オブジェクト（ステータス 200）
 *   - 失敗時: `{ error: string }` オブジェクト（ステータス 500）
 */
export async function GET() {
    // AbortController を使ってタイムアウトを制御する
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        const llmServiceUrl = process.env.LLM_SERVICE_URL || "http://llm-service:8080";
        const response = await fetch(`${llmServiceUrl}/graph`, {
            signal: controller.signal,
        });

        if (!response.ok) {
            throw new Error(`LLM Service Error: ${response.statusText}`);
        }

        const data = await response.json();
        return NextResponse.json(data);
    } catch (error) {
        // タイムアウト（AbortError）とその他のエラーを区別してログ出力する
        if (error instanceof Error && error.name === "AbortError") {
            console.error(
                `Failed to fetch graph: request timed out after ${FETCH_TIMEOUT_MS}ms`,
                error,
            );
            return NextResponse.json(
                { error: `Failed to fetch graph data: request timed out after ${FETCH_TIMEOUT_MS}ms` },
                { status: 500 },
            );
        }
        console.error("Failed to fetch graph:", error);
        return NextResponse.json({ error: "Failed to fetch graph data" }, { status: 500 });
    } finally {
        // 成功・失敗いずれの場合もタイマーを解除する
        clearTimeout(timeoutId);
    }
}
