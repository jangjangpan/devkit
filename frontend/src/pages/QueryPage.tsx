import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import {
  connectionApi, queryApi, historyApi, schemaApi, schemaErdApi, errorMessage,
  type DbConnection, type QueryResult, type HistoryEntry, type SchemaTable, type SchemaColumn,
} from '../api/client';
import { newColumn, type Table, type BaseType, BASE_TYPES } from '../lib/ddl';

function download(content: string, filename: string, mime: string) {
  const blob = new Blob(['﻿' + content], { type: mime }); // BOM: Excel 한글 호환
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  URL.revokeObjectURL(a.href);
}
function csvCell(v: string | null) {
  const s = v == null ? '' : v;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
async function copyText(text: string, label: string) {
  try { await navigator.clipboard.writeText(text); } catch { /* ignore */ }
  toast.success(`${label} 복사됨`);
}

export default function QueryPage() {
  const nav = useNavigate();
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [conn, setConn] = useState('');
  const [sql, setSql] = useState('SELECT * FROM dk_user');
  const [limit, setLimit] = useState(500);
  const [result, setResult] = useState<QueryResult | null>(null);
  const [running, setRunning] = useState(false);
  const [tab, setTab] = useState<'result' | 'history'>('result');

  // 스키마 브라우저
  const [schemaOpen, setSchemaOpen] = useState(true);
  const [schemas, setSchemas] = useState<string[]>([]);
  const [schema, setSchema] = useState('');
  const [tables, setTables] = useState<SchemaTable[]>([]);
  const [tableFilter, setTableFilter] = useState('');
  const [selTable, setSelTable] = useState<string | null>(null);
  const [columns, setColumns] = useState<SchemaColumn[]>([]);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const [history, setHistory] = useState<HistoryEntry[]>([]);

  useEffect(() => { connectionApi.list().then(setConnections).catch(() => {}); }, []);

  // 스키마 목록 (연결/패널 변경 시) — 현재(로그인) 스키마를 기본 선택해 전체 스캔 회피
  useEffect(() => {
    if (!schemaOpen) return;
    schemaApi.schemas(conn).then((r) => {
      setSchemas(r.schemas);
      setSchema(r.current && r.schemas.includes(r.current) ? r.current : (r.current || ''));
    }).catch(() => setSchemas([]));
    // eslint-disable-next-line
  }, [schemaOpen, conn]);
  // 테이블 목록 (스키마/연결 변경 시) — 스키마 미선택이면 조회하지 않음
  useEffect(() => {
    if (!schemaOpen || !schema) { setTables([]); setSelTable(null); setColumns([]); return; }
    schemaApi.tables(conn, schema).then(setTables).catch((e) => { setTables([]); toast.error(errorMessage(e)); });
    setSelTable(null); setColumns([]);
    // eslint-disable-next-line
  }, [schemaOpen, conn, schema]);

  const filteredTables = useMemo(() => {
    const k = tableFilter.trim().toLowerCase();
    return k ? tables.filter((t) => t.name.toLowerCase().includes(k)) : tables;
  }, [tables, tableFilter]);

  const openTable = async (t: SchemaTable) => {
    if (selTable === t.name) { setSelTable(null); return; }
    setSelTable(t.name);
    try { setColumns(await schemaApi.columns(t.name, conn, t.schema || schema)); }
    catch (e) { toast.error(errorMessage(e)); setColumns([]); }
  };
  const qualified = (t: SchemaTable) => (t.schema ? `${t.schema}.${t.name}` : t.name);
  const insertSelect = (t: SchemaTable) => { setSql(`SELECT * FROM ${qualified(t)}`); };

  // 기존 테이블 → DDL 편집기로 가져오기
  const toDdl = async (t: SchemaTable) => {
    try {
      const def = await schemaApi.tableDef(t.name, conn, t.schema || schema);
      const table: Table = {
        name: def.name,
        schema: def.schema || '',
        comment: '',
        columns: def.columns.map((c) => newColumn({
          name: c.name,
          type: (BASE_TYPES.includes(c.type as BaseType) ? c.type : 'VARCHAR') as BaseType,
          length: c.length || '',
          pk: c.pk, notNull: c.notNull, comment: c.comment || '',
        })),
        indexes: [],
      };
      nav('/ddl', { state: { importTable: table } });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const toggleCheck = (name: string) => setChecked((s) => {
    const n = new Set(s);
    n.has(name) ? n.delete(name) : n.add(name);
    return n;
  });
  const importErd = async () => {
    if (checked.size === 0) return toast.error('테이블을 선택하세요(체크박스).');
    try {
      const erd = await schemaErdApi.erd([...checked], conn, schema);
      nav('/erd', { state: { importErd: erd } });
    } catch (e) {
      toast.error(errorMessage(e));
    }
  };

  const run = async () => {
    if (!sql.trim()) return toast.error('SQL을 입력하세요.');
    setRunning(true); setResult(null); setTab('result');
    try {
      const t0 = performance.now();
      const r = await queryApi.run(sql, conn, limit);
      const ms = Math.round(performance.now() - t0);
      setResult(r);
      if (r.affected !== undefined) toast.success(`실행 완료 · ${r.affected}건 반영 · ${ms}ms`);
      else toast.success(`${r.rowCount}행 조회 · ${ms}ms${r.truncated ? ' (제한 도달)' : ''}`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setRunning(false);
    }
  };
  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); run(); }
  };

  const loadHistory = async () => { try { setHistory(await historyApi.list(100)); } catch (e) { toast.error(errorMessage(e)); } };
  const showHistory = () => { setTab('history'); loadHistory(); };
  const useHistory = (h: HistoryEntry) => {
    setSql(h.sql_text);
    const c = connections.find((x) => x.name === h.conn_name);
    setConn(c ? c.id : '');
    setTab('result');
    toast.success('SQL을 편집기에 불러왔습니다.');
  };
  const clearHistory = async () => { if (!confirm('이력을 모두 지울까요?')) return; await historyApi.clear(); loadHistory(); };

  const ts = () => new Date().toISOString().slice(0, 19).replace(/[:T]/g, '');
  const exportData = (kind: 'csv' | 'txt') => {
    if (!result?.columns || !result.rows?.length) return toast.error('내보낼 결과가 없습니다.');
    const sep = kind === 'csv' ? ',' : '\t';
    const esc = kind === 'csv' ? csvCell : (v: string | null) => (v == null ? '' : v);
    const head = result.columns.map((c) => esc(c)).join(sep);
    const body = result.rows.map((row) => row.map((c) => esc(c)).join(sep)).join('\r\n');
    download(`${head}\r\n${body}`, `query_${ts()}.${kind}`, kind === 'csv' ? 'text/csv;charset=utf-8' : 'text/plain;charset=utf-8');
    toast.success(`${kind.toUpperCase()}로 내보냈습니다.`);
  };

  const actions = (
    <>
      <button className={`dk-btn-secondary !py-1.5 whitespace-nowrap ${schemaOpen ? '!bg-dk-blue !text-white' : ''}`} onClick={() => setSchemaOpen((o) => !o)}>스키마</button>
      <select className="dk-input !py-1.5" value={conn} onChange={(e) => setConn(e.target.value)} title="대상 DB">
        <option value="">앱 기본 DB</option>
        {connections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
      </select>
      <select className="dk-input !py-1.5" value={limit} onChange={(e) => setLimit(Number(e.target.value))} title="최대 행">
        {[100, 500, 1000, 2000].map((n) => <option key={n} value={n}>{n}행</option>)}
      </select>
      <button className="dk-btn-secondary !py-1.5 whitespace-nowrap" onClick={() => nav('/connections')}>연결 관리</button>
      <button className="dk-btn-primary !py-1.5 whitespace-nowrap" onClick={run} disabled={running}>실행 <span className="ml-1 text-[11px] px-1 rounded bg-white/20">Ctrl+Enter</span></button>
    </>
  );

  return (
    <Layout title="DB 쿼리" subtitle="스키마 탐색 · SQL 실행 · 결과 CSV/TXT 내보내기 · 이력" actions={actions} flush>
      <div className="flex h-full">
        {/* 스키마 브라우저 */}
        {schemaOpen && (
          <div className="w-64 shrink-0 border-r border-gray-100 dark:border-[#243149] flex flex-col bg-white dark:bg-[#162033]">
            <div className="p-2 border-b border-gray-100 dark:border-[#243149] space-y-1.5">
              <div className="flex items-center gap-1">
                <select className="dk-input flex-1 min-w-0 !py-1 text-xs" value={schema} onChange={(e) => setSchema(e.target.value)}>
                  <option value="">(스키마 선택)</option>
                  {schemas.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <button className="dk-btn-ghost !px-2 !py-1 text-xs shrink-0 disabled:opacity-40" disabled={!schema}
                  title="스키마명 복사" onClick={() => { if (schema) copyText(schema, '스키마명'); }}>📋</button>
              </div>
              <input className="dk-input w-full !py-1 text-xs" placeholder="테이블 검색…" value={tableFilter} onChange={(e) => setTableFilter(e.target.value)} />
              <div className="flex items-center gap-1">
                <button className="dk-btn-primary !py-1 text-xs flex-1 disabled:opacity-50" disabled={checked.size === 0} onClick={importErd}>
                  ERD로 ({checked.size})
                </button>
                {checked.size > 0 && <button className="dk-btn-ghost !py-1 text-xs" onClick={() => setChecked(new Set())}>해제</button>}
              </div>
            </div>
            <div className="flex-1 overflow-auto text-sm">
              {filteredTables.length === 0 && <div className="px-3 py-3 text-xs text-gray-400">테이블이 없습니다.</div>}
              {filteredTables.map((t) => (
                <div key={`${t.schema}.${t.name}`}>
                  <div className="group flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 dark:hover:bg-white/5 cursor-pointer"
                    onClick={() => openTable(t)} onDoubleClick={() => insertSelect(t)}>
                    <span className="flex items-center gap-1.5 min-w-0">
                      <input type="checkbox" className="shrink-0" checked={checked.has(t.name)}
                        onClick={(e) => e.stopPropagation()} onChange={() => toggleCheck(t.name)} />
                      <span className="truncate text-gray-700 dark:text-gray-200">
                        <span className="text-gray-300 mr-1">{t.type === 'VIEW' ? '◫' : '▦'}</span>{t.name}
                      </span>
                    </span>
                    <span className="opacity-0 group-hover:opacity-100 flex items-center gap-1 shrink-0">
                      <button className="text-[10px] text-dk-blue px-1" title="SELECT 삽입"
                        onClick={(e) => { e.stopPropagation(); insertSelect(t); }}>조회</button>
                      <button className="text-[10px] text-dk-orange px-1" title="이 테이블을 DDL 편집기로"
                        onClick={(e) => { e.stopPropagation(); toDdl(t); }}>DDL</button>
                    </span>
                  </div>
                  {selTable === t.name && (
                    <div className="bg-gray-50/60 dark:bg-white/5 px-3 py-1">
                      {columns.length === 0 && <div className="text-[11px] text-gray-400 py-1">컬럼 없음</div>}
                      {columns.map((c) => (
                        <div key={c.name} className="flex items-center gap-1 text-[11px] py-0.5">
                          <span className="text-gray-700 dark:text-gray-200">{c.name}</span>
                          <span className="text-gray-400 font-mono">{c.type}{c.size ? `(${c.size})` : ''}{c.nullable ? '' : ' *'}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 편집기 + 결과 */}
        <div className="flex-1 min-w-0 flex flex-col p-4 gap-3">
          <textarea className="dk-input w-full font-mono text-[13px] h-36 shrink-0" value={sql}
            onChange={(e) => setSql(e.target.value)} onKeyDown={onKeyDown} spellCheck={false} placeholder="SELECT * FROM ..." />

          <div className="flex items-center gap-1 shrink-0">
            <button className={`px-3 py-1 rounded text-xs font-medium ${tab === 'result' ? 'bg-dk-blue text-white' : 'bg-gray-100 dark:bg-[#243149] text-gray-500 dark:text-gray-300'}`} onClick={() => setTab('result')}>결과</button>
            <button className={`px-3 py-1 rounded text-xs font-medium ${tab === 'history' ? 'bg-dk-blue text-white' : 'bg-gray-100 dark:bg-[#243149] text-gray-500 dark:text-gray-300'}`} onClick={showHistory}>이력</button>
            <span className="flex-1" />
            {tab === 'result' && result?.columns && (
              <>
                <button className="dk-btn-ghost !py-1 text-xs" onClick={() => exportData('csv')}>CSV</button>
                <button className="dk-btn-ghost !py-1 text-xs" onClick={() => exportData('txt')}>TXT</button>
              </>
            )}
            {tab === 'history' && <button className="dk-btn-ghost !py-1 text-xs text-dk-red" onClick={clearHistory}>이력 지우기</button>}
          </div>

          <div className="dk-card flex-1 min-h-0 overflow-auto">
            {tab === 'result' ? (
              <>
                {!result && <div className="p-6 text-sm text-gray-400">실행하면 결과가 여기에 표시됩니다. (Ctrl+Enter)</div>}
                {result?.affected !== undefined && <div className="p-6 text-sm text-gray-600 dark:text-gray-200">실행 완료 — <b>{result.affected}</b>건 반영되었습니다.</div>}
                {result?.columns && (
                  <table className="text-sm border-collapse w-max min-w-full">
                    <thead className="sticky top-0 bg-gray-50 dark:bg-[#1b2942] text-xs text-gray-500 dark:text-gray-300">
                      <tr>
                        <th className="px-2 py-1.5 border border-gray-100 dark:border-[#243149] w-10">#</th>
                        {result.columns.map((c, i) => <th key={i} className="px-3 py-1.5 border border-gray-100 dark:border-[#243149] text-left whitespace-nowrap font-bold text-gray-700 dark:text-gray-100">{c}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {result.rows?.map((row, ri) => (
                        <tr key={ri} className="hover:bg-gray-50/60 dark:hover:bg-white/5">
                          <td className="px-2 py-1 border border-gray-100 dark:border-[#243149] text-center text-xs text-gray-300 cursor-pointer hover:text-dk-blue"
                            title="행 전체 복사(TSV)" onClick={() => copyText(row.map((c) => c ?? '').join('\t'), '행')}>{ri + 1}</td>
                          {row.map((cell, ci) => (
                            <td key={ci} title="클릭하여 복사"
                              className={`px-3 py-1 border border-gray-100 dark:border-[#243149] whitespace-nowrap cursor-pointer ${cell === null ? 'text-gray-300 italic' : 'text-gray-700 dark:text-gray-100'}`}
                              onClick={() => copyText(cell ?? '', '셀')}>{cell === null ? 'NULL' : cell}</td>
                          ))}
                        </tr>
                      ))}
                      {result.rows?.length === 0 && <tr><td colSpan={(result.columns?.length || 0) + 1} className="px-3 py-4 text-center text-gray-400 text-xs">결과가 없습니다.</td></tr>}
                    </tbody>
                  </table>
                )}
                {result?.truncated && <div className="p-2 text-[11px] text-dk-orange">최대 {limit}행까지만 표시됩니다.</div>}
              </>
            ) : (
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-gray-50 dark:bg-[#1b2942] text-xs text-gray-400">
                  <tr><th className="text-left px-3 py-1.5 w-16">종류</th><th className="text-left px-3 py-1.5 w-28">대상</th><th className="text-left px-3 py-1.5">SQL</th><th className="text-left px-3 py-1.5 w-24">결과</th><th className="text-left px-3 py-1.5 w-36">시각</th></tr>
                </thead>
                <tbody>
                  {history.length === 0 && <tr><td colSpan={5} className="px-3 py-4 text-center text-gray-400 text-xs">이력이 없습니다.</td></tr>}
                  {history.map((h) => (
                    <tr key={h.id} className="border-t border-gray-50 dark:border-[#243149] hover:bg-gray-50/60 dark:hover:bg-white/5 cursor-pointer" onClick={() => useHistory(h)}>
                      <td className="px-3 py-1.5"><span className={`text-[10px] px-1.5 rounded-full ${h.kind === 'exec' ? 'bg-dk-orange/15 text-dk-orange' : 'bg-dk-blue/10 text-dk-blue'}`}>{h.kind}</span></td>
                      <td className="px-3 py-1.5 text-gray-500 dark:text-gray-300 truncate">{h.conn_name}</td>
                      <td className="px-3 py-1.5 font-mono text-[11px] text-gray-600 dark:text-gray-300 truncate max-w-0">{h.sql_text}</td>
                      <td className="px-3 py-1.5 text-xs"><span className={h.status === 'error' ? 'text-dk-red' : 'text-dk-green'}>{h.status}</span> <span className="text-gray-400">{h.result_info}</span></td>
                      <td className="px-3 py-1.5 text-[11px] text-gray-400">{h.created_at}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}
