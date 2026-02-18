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
                nodeLabel="id"
                nodeColor={node => node.group === 'Concept' ? '#4ade80' : '#60a5fa'}
                nodeRelSize={6}
                linkColor={(link: any) => link.is_personal ? '#fbbf24' : '#94a3b8'}
                linkWidth={(link: any) => link.weight ? link.weight * 2 : 1}
                linkLabel={(link: any) => `${link.label} (w=${link.weight})`}
                linkDirectionalArrowLength={3.5}
                linkDirectionalArrowRelPos={1}
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
