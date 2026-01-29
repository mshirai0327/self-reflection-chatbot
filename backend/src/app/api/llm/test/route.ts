import { NextRequest, NextResponse } from "next/server";
import axios from "axios";
import { normalizeLocalEndpoint } from "@/lib/llm";

/**
 * 指定された LLM エンドポイントへの疎通確認を行います。
 */
export async function POST(req: NextRequest) {
    try {
        const { endpoint, apiKey } = await req.json();

        if (!endpoint) {
            return NextResponse.json({ error: "Endpoint is required" }, { status: 400 });
        }

        console.log(`[LLM Test API] Testing connection to: ${endpoint}`);

        // 正規化してモデル一覧取得エンドポイントでテスト
        const testUrl = normalizeLocalEndpoint(endpoint, "/models");
        console.log(`[LLM Test API] Normalized test URL: ${testUrl}`);

        const response = await axios.get(testUrl, {
            headers: {
                ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {})
            },
            timeout: 5000
        }).catch(err => {
            // 404などでもレスポンスがあれば「サーバーは動いている」とみなす
            if (err.response) return err.response;
            throw err;
        });

        return NextResponse.json({
            success: true,
            message: "Successfully connected to the endpoint.",
            status: response.status
        });
    } catch (error: any) {
        console.error("[LLM Test API Error]:", error.message);
        return NextResponse.json({
            success: false,
            error: "Connection failed. Please check the URL and ensure the LLM server is running.",
            details: error.message
        }, { status: 500 });
    }
}
