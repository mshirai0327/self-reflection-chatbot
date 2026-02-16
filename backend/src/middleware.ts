import { NextRequest, NextResponse } from "next/server";

/**
 * CORS制御ミドルウェア
 *
 * 環境変数 `ALLOWED_ORIGINS` に指定されたオリジンからのリクエストのみを許可します。
 * 開発環境では localhost からのアクセスを許可し、本番環境では明示的に指定されたドメインのみ許可します。
 *
 * @see https://nextjs.org/docs/app/building-your-application/routing/middleware
 */

/**
 * 環境変数からCORS許可オリジンリストを取得します。
 * 未設定の場合、開発環境ではデフォルトでlocalhost:5173を許可します。
 */
function getAllowedOrigins(): string[] {
    const envOrigins = process.env.ALLOWED_ORIGINS;
    if (envOrigins) {
        return envOrigins.split(",").map((o) => o.trim()).filter(Boolean);
    }
    // デフォルト: 開発環境ではフロントエンドのオリジンを許可
    if (process.env.NODE_ENV !== "production") {
        return ["http://localhost:5173", "http://localhost:3000"];
    }
    // 本番でALLOWED_ORIGINSが未設定の場合は空配列（全拒否）
    return [];
}

/**
 * リクエストのオリジンが許可リストに含まれているかチェックします。
 */
function isOriginAllowed(origin: string | null): boolean {
    if (!origin) return true; // Same-origin リクエスト（ブラウザからの非CORSリクエスト）は許可
    const allowed = getAllowedOrigins();
    return allowed.includes(origin);
}

export function middleware(request: NextRequest) {
    const origin = request.headers.get("origin");
    const isAllowed = isOriginAllowed(origin);

    // プリフライトリクエスト（OPTIONS）の処理
    if (request.method === "OPTIONS") {
        if (!isAllowed) {
            return new NextResponse(null, { status: 403 });
        }
        return new NextResponse(null, {
            status: 200,
            headers: {
                "Access-Control-Allow-Origin": origin || "*",
                "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type, Authorization",
                "Access-Control-Max-Age": "86400",
            },
        });
    }

    // 通常のリクエスト
    const response = NextResponse.next();

    if (isAllowed && origin) {
        response.headers.set("Access-Control-Allow-Origin", origin);
        response.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
        response.headers.set("Access-Control-Allow-Headers", "Content-Type, Authorization");
    }

    return response;
}

/**
 * ミドルウェアの適用対象パス
 * /api/ 以下のすべてのルートにCORS制御を適用
 */
export const config = {
    matcher: "/api/:path*",
};
