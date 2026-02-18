import React, { useEffect, useState, useRef } from 'react';
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

    if (loading) return <div className="text-white p-4">Loading Knowledge Graph...</div>;
    if (!data.nodes.length) return <div className="text-white p-4">No knowledge graph data yet. Chat with Reflecta to build memory!</div>;

    return (
        <div className="w-full h-full bg-slate-900 rounded-lg overflow-hidden border border-slate-700">
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
                onEngineStop={() => fgRef.current.zoomToFit(400)}
                width={800} // Adjust based on container
                height={600}
            />
            <div className="absolute bottom-4 right-4 bg-slate-800 p-2 rounded text-xs text-slate-300 opacity-80">
                <div><span className="inline-block w-3 h-3 bg-green-400 rounded-full mr-1"></span> Concept</div>
                <div><span className="inline-block w-3 h-1 bg-yellow-400 mr-1"></span> Personal (Variable)</div>
                <div><span className="inline-block w-3 h-1 bg-slate-400 mr-1"></span> Universal (Invariant)</div>
            </div>
        </div>
    );
};
