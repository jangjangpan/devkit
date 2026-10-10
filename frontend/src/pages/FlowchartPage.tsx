import { useCallback, useMemo, useRef, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState, useReactFlow, MarkerType, ConnectionMode, SelectionMode,
  type Edge, type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { toPng } from 'html-to-image';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import ProjectControls from '../components/ProjectControls';
import ShapeNode, { type ShapeKind, type ShapeNodeT } from '../components/flow/ShapeNode';
import { uid } from '../lib/ddl';
import { layoutNodes } from '../lib/autoLayout';

// 순서도 엣지 공통 스타일 (직각 라우팅 + 라벨 배경으로 가독성)
const FLOW_EDGE = {
  type: 'smoothstep' as const,
  markerEnd: { type: MarkerType.ArrowClosed },
  style: { stroke: '#374151', strokeWidth: 1.5 },
  labelStyle: { fontSize: 11, fill: '#374151', fontWeight: 600 },
  labelBgStyle: { fill: '#ffffff', fillOpacity: 0.9 },
  labelBgPadding: [4, 2] as [number, number],
  labelBgBorderRadius: 4,
};

const SHAPE_DEFS: { kind: ShapeKind; label: string; color: string }[] = [
  { kind: 'terminator', label: '시작/종료', color: '#6FAA52' },
  { kind: 'process', label: '처리', color: '#1A67A3' },
  { kind: 'decision', label: '분기', color: '#FB8C00' },
  { kind: 'io', label: '입출력', color: '#663399' },
  { kind: 'subroutine', label: '정의된 처리', color: '#2C7873' },
  { kind: 'document', label: '문서', color: '#0F2D52' },
  { kind: 'database', label: 'DB', color: '#7A4EA8' },
  { kind: 'hexagon', label: '준비', color: '#B8860B' },
  { kind: 'connector', label: '연결자', color: '#4B5563' },
];

function FlowInner() {
  const [nodes, setNodes, onNodesChange] = useNodesState<ShapeNodeT>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [selEdge, setSelEdge] = useState<string | null>(null);
  const [name, setName] = useState('Untitled');
  const [currentId, setCurrentId] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);

  const { fitView } = useReactFlow();
  const nodeTypes = useMemo(() => ({ shape: ShapeNode }), []);

  const autoLayout = () => {
    if (!nodes.length) return toast.error('도형이 없습니다.');
    setNodes(layoutNodes(nodes, edges, 'TB'));
    window.setTimeout(() => fitView({ duration: 300, padding: 0.2 }), 60);
  };

  const onConnect = useCallback(
    (c: Connection) =>
      setEdges((eds) => addEdge({ ...c, ...FLOW_EDGE, label: '' }, eds)),
    [setEdges],
  );

  const selNode = nodes.find((n) => n.id === selId) || null;
  const selEdgeObj = edges.find((e) => e.id === selEdge) || null;

  const addShape = (kind: ShapeKind, label: string, color: string) => {
    const id = uid();
    const n: ShapeNodeT = {
      id, type: 'shape',
      position: { x: 120 + (nodes.length % 5) * 60, y: 80 + nodes.length * 50 },
      data: { label, shape: kind, color },
    };
    setNodes((ns) => [...ns, n]);
    setSelId(id);
    setSelEdge(null);
  };

  const patchNode = (patch: Partial<ShapeNodeT['data']>) =>
    setNodes((ns) => ns.map((n) => (n.id === selId ? { ...n, data: { ...n.data, ...patch } } : n)));

  const deleteNode = () => {
    if (!selId) return;
    setNodes((ns) => ns.filter((n) => n.id !== selId));
    setEdges((es) => es.filter((e) => e.source !== selId && e.target !== selId));
    setSelId(null);
  };

  const patchEdgeLabel = (label: string) =>
    setEdges((es) => es.map((e) => (e.id === selEdge ? { ...e, label } : e)));

  const deleteEdge = () => {
    if (!selEdge) return;
    setEdges((es) => es.filter((e) => e.id !== selEdge));
    setSelEdge(null);
  };

  // 저장/복원
  const getContent = () =>
    JSON.stringify({
      nodes: nodes.map((n) => ({ id: n.id, position: n.position, data: n.data })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, sourceHandle: e.sourceHandle, targetHandle: e.targetHandle, label: e.label })),
    });

  const onLoad = (content: string) => {
    if (!content) { setNodes([]); setEdges([]); setSelId(null); setSelEdge(null); return; }
    try {
      const d = JSON.parse(content);
      setNodes((d.nodes || []).map((n: any) => ({ id: n.id, type: 'shape', position: n.position, data: n.data })));
      setEdges((d.edges || []).map((e: any) => ({ ...e, ...FLOW_EDGE })));
      setSelId(null); setSelEdge(null);
    } catch {
      toast.error('불러오기에 실패했습니다 (형식 오류).');
    }
  };

  const exportPng = async () => {
    const el = wrapRef.current?.querySelector('.react-flow') as HTMLElement | null;
    if (!el) return;
    try {
      const url = await toPng(el, { backgroundColor: '#ffffff', pixelRatio: 2 });
      const a = document.createElement('a');
      a.download = `${name || 'flowchart'}.png`;
      a.href = url;
      a.click();
      toast.success('PNG로 내보냈습니다.');
    } catch {
      toast.error('이미지 내보내기에 실패했습니다.');
    }
  };

  const actions = (
    <>
      <div className="flex items-center gap-1">
        {SHAPE_DEFS.map((s) => (
          <button key={s.kind} className="dk-btn-secondary !py-1.5 !px-2.5 text-xs"
            onClick={() => addShape(s.kind, s.label, s.color)}>
            + {s.label}
          </button>
        ))}
      </div>
      <button className="dk-btn-secondary !py-1.5 whitespace-nowrap" onClick={autoLayout}>자동 정렬</button>
      <button className="dk-btn-secondary !py-1.5" onClick={exportPng}>PNG</button>
      <ProjectControls
        type="flowchart" name={name} setName={setName}
        currentId={currentId} setCurrentId={setCurrentId}
        getContent={getContent} onLoad={onLoad}
      />
    </>
  );

  return (
    <Layout title="순서도" subtitle="핸들 끌어 연결 · 더블클릭 편집 · 빈 영역 드래그로 다중선택(이동은 우클릭/휠 드래그) · Delete 삭제" actions={actions} flush>
      <div className="flex h-full" ref={wrapRef}>
        <div className="flex-1 min-w-0 relative">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={(_, n) => { setSelId(n.id); setSelEdge(null); }}
            onEdgeClick={(_, e) => { setSelEdge(e.id); setSelId(null); }}
            onPaneClick={() => { setSelId(null); setSelEdge(null); }}
            onNodesDelete={(deleted) => { if (deleted.some((n) => n.id === selId)) setSelId(null); }}
            onEdgesDelete={(deleted) => { if (deleted.some((e) => e.id === selEdge)) setSelEdge(null); }}
            nodeTypes={nodeTypes}
            connectionMode={ConnectionMode.Loose}
            connectionRadius={45}
            deleteKeyCode={['Delete', 'Backspace']}
            selectionOnDrag
            panOnDrag={[1, 2]}
            selectionMode={SelectionMode.Partial}
            fitView
          >
            <Background gap={16} color="#e5e7eb" />
            <Controls />
            <MiniMap pannable zoomable />
          </ReactFlow>
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <p className="text-sm text-gray-400">상단의 도형 버튼으로 순서도를 그리기 시작하세요.</p>
            </div>
          )}
        </div>

        {/* 노드 편집 패널 */}
        {selNode && (
          <div className="w-72 shrink-0 border-l border-gray-100 bg-white dark:border-[#243149] dark:bg-[#162033] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-600">도형 편집</span>
              <button className="text-xs text-dk-red hover:underline" onClick={deleteNode}>삭제</button>
            </div>
            <div>
              <label className="text-xs text-gray-400">텍스트</label>
              <textarea className="dk-input w-full mt-1" rows={3} value={selNode.data.label}
                onChange={(e) => patchNode({ label: e.target.value })} />
            </div>
            <div>
              <label className="text-xs text-gray-400">모양</label>
              <select className="dk-input w-full mt-1" value={selNode.data.shape}
                onChange={(e) => patchNode({ shape: e.target.value as ShapeKind })}>
                {SHAPE_DEFS.map((s) => <option key={s.kind} value={s.kind}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400">색상</label>
              <input type="color" className="w-full h-9 mt-1 rounded border border-gray-200 cursor-pointer"
                value={selNode.data.color} onChange={(e) => patchNode({ color: e.target.value })} />
            </div>
          </div>
        )}

        {/* 엣지 편집 패널 */}
        {selEdgeObj && (
          <div className="w-72 shrink-0 border-l border-gray-100 bg-white dark:border-[#243149] dark:bg-[#162033] p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-600">연결선 편집</span>
              <button className="text-xs text-dk-red hover:underline" onClick={deleteEdge}>삭제</button>
            </div>
            <div>
              <label className="text-xs text-gray-400">라벨 (예: 예 / 아니오)</label>
              <input className="dk-input w-full mt-1" value={(selEdgeObj.label as string) || ''}
                onChange={(e) => patchEdgeLabel(e.target.value)} placeholder="조건 라벨" />
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default function FlowchartPage() {
  return (
    <ReactFlowProvider>
      <FlowInner />
    </ReactFlowProvider>
  );
}
