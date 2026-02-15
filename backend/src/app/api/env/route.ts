import { NextResponse } from "next/server";
import { isLocalLLMProxyEnabled, isProduction } from "@/lib/env";

/**
 * フロントエンドに現在の環境設定を返すAPIエンドポイント。
 *
 * フロントエンドはこの情報を使って、環境に応じたUI表示の切り替え
 * （例: 本番環境では Local LLM 設定UIを非表示にする）を行います。
 */
export async function GET() {
    return NextResponse.json({
        /** 本番環境かどうか */
        isProduction: isProduction(),
        /** Local LLM プロキシが有効かどうか（SSRF対策で本番では無効） */
        isLocalLLMEnabled: isLocalLLMProxyEnabled(),
    });
}
