import { Fragment, useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  addEdge, useNodesState, useEdgesState, useReactFlow, MarkerType, SelectionMode,
  type Node, type Edge, type Connection,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import ProjectControls from '../components/ProjectControls';
import IndexEditor from '../components/IndexEditor';
import SearchSelect from '../components/SearchSelect';
import EntityNode from '../components/erd/EntityNode';
import { ErdDialectContext } from '../components/erd/dialectContext';
import { layoutNodes } from '../lib/autoLayout';
import {
  Table, Column, BaseType, Dialect, DIALECTS, BASE_TYPES, TYPES_WITH_LENGTH,
  DEFAULT_OPTIONS, generateDDL, generateFkDDL, newTable, newColumn, uid,
  type Relation,
} from '../lib/ddl';
import { dictApi, errorMessage, type DictTable, type DictColumn, type SchemaErd } from '../api/client';

type EntityNodeT = Node<{ table: Table }>;
interface ColPair { from: string; to: string }

function ErdInner() {
  const loc = useLocation();
  const [nodes, setNodes, onNodesChange] = useNodesState<EntityNodeT>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [selId, setSelId] = useState<string | null>(null);
  const [selEdge, setSelEdge] = useState<string | null>(null);
  const [dialect, setDialect] = useState<Dialect>('oracle');
  const [showDdl, setShowDdl] = useState(false);

  const [name, setName] = useState('Untitled');
  const [currentId, setCurrentId] = useState<string | null>(null);

  // 표준 사전
  const [dictTables, setDictTables] = useState<DictTable[]>([]);
  const [dictColumns, setDictColumns] = useState<DictColumn[]>([]);
  useEffect(() => {
    dictApi.listTables().then(setDictTables).catch((e) => toast.error(errorMessage(e)));
    dictApi.listColumns().then(setDictColumns).catch(() => {});
  }, []);

  const { fitView, getNodes, getEdges } = useReactFlow();
  const nodeTypes = useMemo(() => ({ entity: EntityNode }), []);

  // getNodes/getEdges로 항상 최신(측정된 크기 포함) 노드 기준 정렬
  const autoLayout = (silent = false) => {
    const cur = getNodes();
    if (!cur.length) { if (!silent) toast.error('테이블이 없습니다.'); return; }
    setNodes(layoutNodes(cur as EntityNodeT[], getEdges(), 'LR'));
    window.setTimeout(() => fitView({ duration: 300, padding: 0.2 }), 60);
  };

  const tableOf = (nodeId: string | null | undefined) =>
    nodes.find((n) => n.id === nodeId)?.data.table || null;

  const pairsLabel = (pairs: ColPair[]) => {
    const v = pairs.filter((p) => p.from && p.to);
    return v.length ? `${v.map((p) => p.from).join(', ')} → ${v.map((p) => p.to).join(', ')}` : '';
  };
  const EDGE_VISUAL = {
    labelStyle: { fontSize: 11, fill: '#374151' },
    labelBgStyle: { fill: '#fff', fillOpacity: 0.85 },
    markerEnd: { type: MarkerType.ArrowClosed },
    style: { stroke: '#1A67A3', strokeWidth: 1.5 },
  };

  // 관계선 = FK. source(자식, FK 보유) → target(부모, PK 참조). 자기참조(source===target) 허용.
  const onConnect = useCallback(
    (c: Connection) =>
      setEdges((eds) => {
        const parent = nodes.find((n) => n.id === c.target)?.data.table;
        const child = nodes.find((n) => n.id === c.source)?.data.table;
        const toCol = parent?.columns.find((col) => col.pk)?.name || parent?.columns[0]?.name || '';
        // 자기참조면 동일 PK를 그대로 두지 않고 비워서 사용자가 FK 컬럼을 고르게 함
        const selfRef = c.source === c.target;
        const fromCol = selfRef ? '' : (child?.columns.find((col) => col.name === toCol)?.name || toCol);
        const pairs: ColPair[] = [{ from: fromCol, to: toCol }];
        return addEdge({ ...c, data: { pairs }, label: pairsLabel(pairs), ...EDGE_VISUAL }, eds);
      }),
    [nodes, setEdges],
  );

  const selNode = nodes.find((n) => n.id === selId) || null;
  const selTable = selNode?.data.table || null;
  const selEdgeObj = edges.find((e) => e.id === selEdge) || null;
  const selPairs: ColPair[] = ((selEdgeObj?.data as { pairs?: ColPair[] } | undefined)?.pairs) || [];

  const setPairs = (pairs: ColPair[]) =>
    setEdges((es) => es.map((e) => (e.id === selEdge
      ? { ...e, data: { pairs }, label: pairsLabel(pairs) } : e)));

  const updatePair = (idx: number, patch: Partial<ColPair>) =>
    setPairs(selPairs.map((p, i) => (i === idx ? { ...p, ...patch } : p)));
  const addPair = () => setPairs([...selPairs, { from: '', to: '' }]);
  const removePair = (idx: number) => setPairs(selPairs.filter((_, i) => i !== idx));

  const deleteEdge = () => {
    if (!selEdge) return;
    setEdges((es) => es.filter((e) => e.id !== selEdge));
    setSelEdge(null);
  };

  const patchTable = (patch: Partial<Table>) =>
    setNodes((ns) => ns.map((n) => (n.id === selId ? { ...n, data: { table: { ...n.data.table, ...patch } } } : n)));

  const patchColumn = (cid: string, patch: Partial<Column>) => {
    if (!selTable) return;
    patchTable({ columns: selTable.columns.map((c) => (c.id === cid ? { ...c, ...patch } : c)) });
  };

  // 사전 매핑
  const selectDictTable = (dt: DictTable) =>
    patchTable({ name: dt.table_cd, schema: dt.schema_nm || '', comment: dt.comment || dt.table_nm || '' });
  const addColumnFromDict = (dc: DictColumn) => {
    if (!selTable) return;
    const type = (BASE_TYPES.includes(dc.col_type as BaseType) ? dc.col_type : 'VARCHAR') as BaseType;
    patchTable({ columns: [...selTable.columns, newColumn({
      name: dc.column_cd, type, length: dc.col_length || '', comment: dc.column_nm || dc.comment || '',
    })] });
  };

  const addEntity = () => {
    const id = uid();
    const t = newTable(`TABLE_${nodes.length + 1}`);
    const n: EntityNodeT = {
      id, type: 'entity',
      position: { x: 80 + (nodes.length % 4) * 240, y: 80 + Math.floor(nodes.length / 4) * 200 },
      data: { table: t },
    };
    setNodes((ns) => [...ns, n]);
    setSelId(id);
  };

  const deleteEntity = () => {
    if (!selId) return;
    setNodes((ns) => ns.filter((n) => n.id !== selId));
    setEdges((es) => es.filter((e) => e.source !== selId && e.target !== selId));
    setSelId(null);
  };

  // 저장/복원
  const getContent = () =>
    JSON.stringify({
      dialect,
      nodes: nodes.map((n) => ({ id: n.id, position: n.position, table: n.data.table })),
      edges: edges.map((e) => ({ id: e.id, source: e.source, target: e.target, data: e.data })),
    });

  const onLoad = (content: string) => {
    if (!content) {
      setNodes([]); setEdges([]); setSelId(null); setSelEdge(null); return;
    }
    try {
      const d = JSON.parse(content);
      setNodes((d.nodes || []).map((n: any) => ({ id: n.id, type: 'entity', position: n.position, data: { table: n.table } })));
      setEdges((d.edges || []).map((e: any) => {
        // 구버전({fromColumn,toColumn}) → 신버전({pairs}) 마이그레이션
        let pairs: ColPair[] = e.data?.pairs;
        if (!pairs) {
          pairs = e.data?.fromColumn || e.data?.toColumn
            ? [{ from: e.data.fromColumn || '', to: e.data.toColumn || '' }]
            : [{ from: '', to: '' }];
        }
        return {
          id: e.id, source: e.source, target: e.target,
          data: { pairs },
          label: pairsLabel(pairs),
          ...EDGE_VISUAL,
        };
      }));
      if (d.dialect) setDialect(d.dialect);
      setSelId(null); setSelEdge(null);
    } catch {
      toast.error('불러오기에 실패했습니다 (형식 오류).');
    }
  };

  // 스키마 브라우저에서 여러 테이블 가져오기 (테이블 + FK 관계)
  useEffect(() => {
    const imp = (loc.state as { importErd?: SchemaErd } | null)?.importErd;
    if (!imp || !imp.tables) return;
    const idByName: Record<string, string> = {};
    const ns: EntityNodeT[] = imp.tables.map((def, i) => {
      const id = uid();
      idByName[def.name.toLowerCase()] = id;
      const table: Table = {
        name: def.name, schema: def.schema || '', comment: '',
        columns: def.columns.map((c) => newColumn({
          name: c.name,
          type: (BASE_TYPES.includes(c.type as BaseType) ? c.type : 'VARCHAR') as BaseType,
          length: c.length || '', pk: c.pk, notNull: c.notNull, comment: c.comment || '',
        })),
        indexes: [],
      };
      return { id, type: 'entity', position: { x: 60 + (i % 4) * 280, y: 60 + Math.floor(i / 4) * 240 }, data: { table } };
    });
    const es = imp.relations.map((r) => {
      const source = idByName[r.fromTable.toLowerCase()];
      const target = idByName[r.toTable.toLowerCase()];
      if (!source || !target) return null;
      const pairs: ColPair[] = r.fromColumns.map((f, i) => ({ from: f, to: r.toColumns[i] || '' }));
      return { id: uid(), source, target, data: { pairs }, label: pairsLabel(pairs), ...EDGE_VISUAL };
    }).filter(Boolean) as Edge[];
    setNodes(ns);
    setEdges(es);
    setSelId(null); setSelEdge(null);
    window.history.replaceState({}, '');
    toast.success(`${ns.length}개 테이블 · ${es.length}개 관계를 ERD로 가져왔습니다.`);
    // 노드가 렌더·측정된 뒤 자동 정렬
    window.setTimeout(() => autoLayout(true), 400);
    // eslint-disable-next-line
  }, []);

  const ddl = useMemo(() => {
    const tablesDDL = generateDDL(nodes.map((n) => n.data.table), dialect, DEFAULT_OPTIONS);
    const seen: Record<string, number> = {};
    const relations: Relation[] = [];
    edges.forEach((e) => {
      const child = nodes.find((n) => n.id === e.source)?.data.table;
      const parent = nodes.find((n) => n.id === e.target)?.data.table;
      if (!child || !parent) return;
      const pairs = ((e.data as { pairs?: ColPair[] } | undefined)?.pairs) || [];
      const key = `${child.name}|${parent.name}`;
      const index = seen[key] = (seen[key] ?? -1) + 1; // 같은 테이블쌍 N번째 → 제약명 충돌 방지
      relations.push({
        fromTable: child.name, fromSchema: child.schema, fromColumns: pairs.map((p) => p.from),
        toTable: parent.name, toSchema: parent.schema, toColumns: pairs.map((p) => p.to),
        index,
      });
    });
    const fk = generateFkDDL(relations, dialect, DEFAULT_OPTIONS);
    return fk ? `${tablesDDL}\n\n-- Foreign Keys\n${fk}` : tablesDDL;
  }, [nodes, edges, dialect]);

  const copyDdl = async () => {
    if (!ddl) return toast.error('테이블이 없습니다.');
    await navigator.clipboard.writeText(ddl);
    toast.success('DDL을 복사했습니다.');
  };

  const actions = (
    <>
      <button className="dk-btn-secondary !py-1.5 whitespace-nowrap" onClick={addEntity}>+ 테이블</button>
      <button className="dk-btn-secondary !py-1.5 whitespace-nowrap" onClick={() => autoLayout()}>자동 정렬</button>
      <select className="dk-input !py-1.5" value={dialect} onChange={(e) => setDialect(e.target.value as Dialect)}>
        {DIALECTS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
      </select>
      <button className="dk-btn-secondary !py-1.5 whitespace-nowrap" onClick={() => setShowDdl(true)}>DDL 보기</button>
      <ProjectControls
        type="erd" name={name} setName={setName}
        currentId={currentId} setCurrentId={setCurrentId}
        getContent={getContent} onLoad={onLoad}
      />
    </>
  );

  return (
    <Layout title="ERD" subtitle="테이블→DDL 내보내기 · 빈 영역 드래그로 다중선택(이동은 우클릭/휠 드래그) · Delete 삭제" actions={actions} flush>
      <div className="flex h-full">
        <div className="flex-1 min-w-0 relative">
          <ErdDialectContext.Provider value={dialect}>
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
            connectionRadius={40}
            deleteKeyCode={['Delete', 'Backspace']}
            selectionOnDrag
            panOnDrag={[1, 2]}
            selectionMode={SelectionMode.Partial}
            fitView
          >
            <Background gap={16} color="#e5e7eb" />
            <Controls />
            <MiniMap nodeColor="#0F2D52" pannable zoomable />
          </ReactFlow>
          </ErdDialectContext.Provider>
          {nodes.length === 0 && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <div className="text-center text-gray-400">
                <p className="text-sm">[+ 테이블] 버튼으로 엔티티를 추가하세요.</p>
                <p className="text-xs mt-1">노드의 우측 핸들을 끌어 다른 테이블과 관계를 연결할 수 있습니다.</p>
              </div>
            </div>
          )}
        </div>

        {/* 엔티티 편집 패널 */}
        {selTable && (
          <div className="w-[360px] shrink-0 border-l border-gray-100 bg-white dark:border-[#243149] dark:bg-[#162033] flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-sm font-bold text-gray-600">엔티티 편집</span>
              <button className="text-xs text-dk-red hover:underline" onClick={deleteEntity}>테이블 삭제</button>
            </div>
            <div className="p-4 space-y-2 overflow-auto flex-1">
              {/* 사전 매핑 */}
              <div className="p-2 rounded-lg bg-dk-blue/5 border border-dk-blue/20 space-y-1.5">
                <SearchSelect
                  placeholder="표준 테이블 검색·선택…"
                  value={dictTables.find((d) => d.table_cd === selTable.name)?.id || ''}
                  options={dictTables.map((d) => ({ value: d.id, label: `${d.table_cd}${d.table_nm ? ` — ${d.table_nm}` : ''}` }))}
                  onSelect={(id) => { const d = dictTables.find((x) => x.id === id); if (d) selectDictTable(d); }}
                />
                <SearchSelect
                  resetOnSelect
                  placeholder="표준 컬럼 검색·추가…"
                  options={dictColumns.map((c) => ({ value: c.id, label: `${c.column_cd}${c.column_nm ? ` — ${c.column_nm}` : ''} [${c.col_type}${c.col_length ? `(${c.col_length})` : ''}]` }))}
                  onSelect={(id) => { const c = dictColumns.find((x) => x.id === id); if (c) addColumnFromDict(c); }}
                />
              </div>
              <input className="dk-input w-full" placeholder="테이블명" value={selTable.name}
                onChange={(e) => patchTable({ name: e.target.value })} />
              <div className="flex gap-2">
                <input className="dk-input w-1/2" placeholder="스키마" value={selTable.schema}
                  onChange={(e) => patchTable({ schema: e.target.value })} />
              </div>
              <div className="pt-2 text-xs font-bold text-gray-400">컬럼</div>
              {selTable.columns.map((c) => (
                <div key={c.id} className="border border-gray-100 rounded p-2 space-y-1.5">
                  <div className="flex gap-1.5">
                    <input className="dk-input flex-1 !py-1" placeholder="컬럼명" value={c.name}
                      onChange={(e) => patchColumn(c.id, { name: e.target.value })} />
                    <button className="text-gray-300 hover:text-dk-red px-1"
                      onClick={() => patchTable({ columns: selTable.columns.filter((x) => x.id !== c.id) })}>✕</button>
                  </div>
                  <div className="flex gap-1.5">
                    <select className="dk-input flex-1 !py-1" value={c.type}
                      onChange={(e) => patchColumn(c.id, { type: e.target.value as Column['type'] })}>
                      {BASE_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <input className="dk-input w-20 !py-1 disabled:bg-gray-50" placeholder="길이"
                      value={c.length} disabled={!TYPES_WITH_LENGTH.includes(c.type)}
                      onChange={(e) => patchColumn(c.id, { length: e.target.value })} />
                  </div>
                  <div className="flex gap-3 text-xs text-gray-600 dark:text-gray-300">
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={c.pk} onChange={(e) => patchColumn(c.id, { pk: e.target.checked })} /> PK
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={c.notNull || c.pk} disabled={c.pk}
                        onChange={(e) => patchColumn(c.id, { notNull: e.target.checked })} /> NOT NULL
                    </label>
                    <label className="flex items-center gap-1 cursor-pointer">
                      <input type="checkbox" checked={c.unique || false} disabled={c.pk}
                        onChange={(e) => patchColumn(c.id, { unique: e.target.checked })} /> UNIQUE
                    </label>
                  </div>
                </div>
              ))}
              <button className="dk-btn-secondary w-full !py-1.5"
                onClick={() => patchTable({ columns: [...selTable.columns, newColumn()] })}>
                + 컬럼 추가
              </button>
              <IndexEditor table={selTable} onChange={(indexes) => patchTable({ indexes })} />
            </div>
          </div>
        )}

        {/* 관계선(FK) 편집 패널 — 다중 컬럼 / 자기참조 */}
        {selEdgeObj && (() => {
          const child = tableOf(selEdgeObj.source);
          const parent = tableOf(selEdgeObj.target);
          const selfRef = selEdgeObj.source === selEdgeObj.target;
          return (
            <div className="w-[360px] shrink-0 border-l border-gray-100 bg-white dark:border-[#243149] dark:bg-[#162033] flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                <span className="text-sm font-bold text-gray-600">관계 (FK) 편집</span>
                <button className="text-xs text-dk-red hover:underline" onClick={deleteEdge}>관계 삭제</button>
              </div>
              <div className="p-4 space-y-3 overflow-auto">
                <p className="text-xs text-gray-500 leading-relaxed bg-gray-50 rounded p-2">
                  <b className="text-dk-blue">{child?.name || '?'}</b>(자식, FK 보유) →
                  <b className="text-dk-navy"> {parent?.name || '?'}</b>(부모, PK 참조)
                  {selfRef && <span className="ml-1 text-dk-orange font-bold">· 자기참조</span>}
                </p>
                <div className="grid grid-cols-[1fr_auto_1fr_auto] gap-x-2 gap-y-1.5 items-center">
                  <span className="text-[11px] font-bold text-gray-400">FK 컬럼 ({child?.name})</span>
                  <span></span>
                  <span className="text-[11px] font-bold text-gray-400">참조 컬럼 ({parent?.name})</span>
                  <span></span>
                  {selPairs.map((p, i) => (
                    <Fragment key={i}>
                      <select className="dk-input w-full !py-1" value={p.from}
                        onChange={(e) => updatePair(i, { from: e.target.value })}>
                        <option value="">(선택)</option>
                        {child?.columns.map((c) => <option key={c.id} value={c.name}>{c.name || '(이름없음)'}{c.pk ? ' (PK)' : ''}</option>)}
                      </select>
                      <span className="text-gray-400 text-xs">→</span>
                      <select className="dk-input w-full !py-1" value={p.to}
                        onChange={(e) => updatePair(i, { to: e.target.value })}>
                        <option value="">(선택)</option>
                        {parent?.columns.map((c) => <option key={c.id} value={c.name}>{c.name || '(이름없음)'}{c.pk ? ' (PK)' : ''}</option>)}
                      </select>
                      <button className="text-gray-300 hover:text-dk-red px-1" disabled={selPairs.length <= 1}
                        onClick={() => removePair(i)}>✕</button>
                    </Fragment>
                  ))}
                </div>
                <button className="dk-btn-secondary w-full !py-1.5" onClick={addPair}>+ 컬럼 쌍 추가 (복합키)</button>
                <div className="pt-1 text-[11px] text-gray-400">
                  쌍을 여러 개 추가하면 복합 FK(<code>FOREIGN KEY (a, b)</code>)가 됩니다.
                  [DDL 보기]에 <code>ALTER TABLE … ADD CONSTRAINT FK_…</code> 자동 생성.
                </div>
              </div>
            </div>
          );
        })()}

        {/* DDL 슬라이드 패널 */}
        {showDdl && (
          <div className="w-[40%] shrink-0 border-l border-gray-100 bg-white dark:border-[#243149] dark:bg-[#162033] flex flex-col overflow-hidden">
            <div className="px-4 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-600">DDL · {DIALECTS.find((d) => d.id === dialect)?.label}</span>
              <div className="flex gap-2">
                <button className="dk-btn-secondary !py-1 text-xs" onClick={copyDdl}>복사</button>
                <button className="dk-btn-ghost !py-1 text-xs" onClick={() => setShowDdl(false)}>닫기</button>
              </div>
            </div>
            <pre className="flex-1 min-h-0 overflow-auto p-3.5 font-mono text-[12.5px] leading-relaxed whitespace-pre bg-[#0f172a] text-[#e2e8f0]">
              {ddl || '// 테이블을 추가하세요.'}
            </pre>
          </div>
        )}
      </div>
    </Layout>
  );
}

export default function ErdPage() {
  return (
    <ReactFlowProvider>
      <ErdInner />
    </ReactFlowProvider>
  );
}
