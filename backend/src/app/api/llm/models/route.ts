import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { normalizeLocalEndpoint } from "@/lib/llm";
import { isLocalLLMProxyEnabled } from "@/lib/env";

/**
 * 指定された OpenAI 互換エンドポイントから利用可能なモデル一覧を取得します。
 * クライアントサイドでの CORS 回避のため、バックエンドがプロキシとして動作します。
 *
 * 注意: SSRF対策として、本番環境ではこのエンドポイントは無効化されます。
 * 環境変数 ENABLE_LOCAL_LLM_PROXY="true" で明示的に有効化できます。
 */
export async function POST(req: NextRequest) {
    // SSRF対策: 本番環境では Local LLM プロキシを無効化
    if (!isLocalLLMProxyEnabled()) {
        return NextResponse.json(
            { error: "Local LLM proxy is disabled in this environment." },
            { status: 403 }
        );
    }

    try {
        const { endpoint, apiKey } = await req.json();

        if (!endpoint) {
            return NextResponse.json({ error: "Endpoint is required" }, { status: 400 });
        }

        // 正規化してモデル一覧取得エンドポイントを作成
        const modelsEndpoint = normalizeLocalEndpoint(endpoint, "/models");

        console.log(`[LLM Models API] Fetching models from: ${modelsEndpoint}`);

        const response = await axios.get(modelsEndpoint, {
            headers: {
                ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {})
            },
            timeout: 5000 // 5秒でタイムアウト
        });

        // OpenAI 互換のレスポンス形式を期待: { data: [{ id: "model-name", ... }, ...] }
        const models = response.data.data?.map((m: any) => m.id) || [];

        return NextResponse.json({ models });
    } catch (error: any) {
        console.error("[LLM Models API Error]:", error.message);
        return NextResponse.json({
            error: "Failed to fetch models. Make sure the endpoint is correct and accessible from the backend.",
            details: error.message
        }, { status: 500 });
    }
}
