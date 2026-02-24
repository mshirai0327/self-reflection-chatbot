import React, { useEffect, useState, useRef, useCallback } from 'react';
import ForceGraph2D from 'react-force-graph-2d';

interface Node {
    id: string;
    group: string;
}

interface Link {
    source: string;
    target: string;
    label: string;
    weight: number;
    is_personal: boolean;
}

interface GraphData {
    nodes: Node[];
    links: Link[];
}

export const GraphViewer: React.FC = () => {
    const [data, setData] = useState<GraphData>({ nodes: [], links: [] });
    const [loading, setLoading] = useState(true);
    const fgRef = useRef<any>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    /** コンテナの実際のサイズを動的に追跡する */
    const [dimensions, setDimensions] = useState({ width: 800, height: 600 });

    /**
     * ResizeObserver でコンテナサイズを監視し、
     * タブ切り替え直後やウィンドウリサイズ時にも正しいサイズを反映する。
     */
    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;

        const observer = new ResizeObserver(entries => {
            for (const entry of entries) {
                const { width, height } = entry.contentRect;
                // サイズが 0 の場合は無視（非表示タブなど）
                if (width > 0 && height > 0) {
                    setDimensions({ width, height });
                }
            }
        });

        observer.observe(container);

        // 初回マウント時にサイズを取得（ResizeObserver が発火する前の保険）
        const { clientWidth, clientHeight } = container;
        if (clientWidth > 0 && clientHeight > 0) {
            setDimensions({ width: clientWidth, height: clientHeight });
        }

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        fetch('/api/graph')
            .then(res => res.json())
            .then(data => {
                setData(data);
                setLoading(false);
            })
            .catch(err => {
                console.error("Failed to load graph", err);
                setLoading(false);
            });
    }, []);

    /**
     * グラフのレイアウト計算完了後にズームをフィットさせる。
     * fgRef が存在しない場合は何もしない。
     */
    const handleEngineStop = useCallback(() => {
        if (fgRef.current) {
            fgRef.current.zoomToFit(400);
        }
    }, []);

    if (loading) return <div className="text-white p-4">Loading Knowledge Graph...</div>;
    if (!data.nodes.length) return <div className="text-white p-4">No knowledge graph data yet. Chat with Reflecta to build memory!</div>;

    return (
        <div ref={containerRef} className="w-full h-full bg-slate-900 rounded-lg overflow-hidden border border-slate-700 relative">
            <ForceGraph2D
                ref={fgRef}
                graphData={data}
                nodeRelSize={6}
                // ノードのカスタム描画（丸とラベルを常時表示）
                nodeCanvasObject={(node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                    const label = node.id;
                    const fontSize = 12 / globalScale;
                    ctx.font = `${fontSize}px Inter, Roboto, "Segoe UI", sans-serif`;
                    const textWidth = ctx.measureText(label).width;
                    const bckgDimensions = [textWidth, fontSize].map(n => n + fontSize * 0.2); // some padding

                    // ノードの円
                    ctx.beginPath();
                    ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false);
                    ctx.fillStyle = node.group === 'Concept' ? '#4ade80' : '#60a5fa';
                    ctx.fill();

                    // テキストの背景（可読性向上のため）
                    ctx.fillStyle = 'rgba(15, 23, 42, 0.6)';
                    ctx.fillRect(node.x - bckgDimensions[0] / 2, node.y + 7, bckgDimensions[0], bckgDimensions[1]);

                    // テキスト
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#f8fafc';
                    ctx.fillText(label, node.x, node.y + 7 + bckgDimensions[1] / 2);
                }}
                nodePointerAreaPaint={(node: any, color, ctx) => {
                    ctx.fillStyle = color;
                    ctx.beginPath(); ctx.arc(node.x, node.y, 5, 0, 2 * Math.PI, false); ctx.fill();
                }}
                // リンクのカスタム描画（ラベルを常時表示）
                linkCanvasObjectMode={() => 'after'}
                linkCanvasObject={(link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
                    const MAX_FONT_SIZE = 4;
                    const LABEL_NODE_MARGIN = 6;

                    const start = link.source;
                    const end = link.target;

                    // リンクの中間点を計算
                    const textPos = Object.assign({}, ...['x', 'y'].map(c => ({
                        [c]: start[c] + (end[c] - start[c]) / 2 // middle point
                    })));

                    const relSize = Math.sqrt(Math.pow(end.x - start.x, 2) + Math.pow(end.y - start.y, 2));
                    const fontSize = Math.min(MAX_FONT_SIZE, (relSize - LABEL_NODE_MARGIN) / link.label.length);

                    ctx.font = `${fontSize}px Sans-Serif`;
                    ctx.fillStyle = link.is_personal ? '#fbbf24' : '#94a3b8';
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillText(link.label, textPos.x, textPos.y);
                }}
                linkColor={(link: any) => link.is_personal ? '#fbbf24' : '#94a3b8'}
                linkWidth={(link: any) => (link.weight ? link.weight * 2 : 1.5)}
                linkDirectionalArrowLength={8} // 矢印を大きく
                linkDirectionalArrowRelPos={1}
                linkDirectionalParticles={2} // 流れを強調
                linkDirectionalParticleSpeed={0.005}
                onEngineStop={handleEngineStop}
                width={dimensions.width}
                height={dimensions.height}
            />
            <div className="absolute bottom-4 right-4 bg-slate-800 p-2 rounded text-xs text-slate-300 opacity-80">
                <div><span className="inline-block w-3 h-3 bg-green-400 rounded-full mr-1"></span> Concept</div>
                <div><span className="inline-block w-3 h-1 bg-yellow-400 mr-1"></span> Personal (Variable)</div>
                <div><span className="inline-block w-3 h-1 bg-slate-400 mr-1"></span> Universal (Invariant)</div>
            </div>
        </div>
    );
};
