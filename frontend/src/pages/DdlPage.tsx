import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import ProjectControls from '../components/ProjectControls';
import DataEntryGrid from '../components/DataEntryGrid';
import IndexEditor from '../components/IndexEditor';
import SearchSelect from '../components/SearchSelect';
import {
  Table, Column, BaseType, Dialect, DIALECTS, BASE_TYPES, TYPES_WITH_LENGTH,
  DdlOptions, DEFAULT_OPTIONS, generateDDL, newTable, newColumn, physicalTypeName,
} from '../lib/ddl';
import { Row, generateDML, generateJson, countErrors } from '../lib/datagen';

type DataMode = 'insert' | 'update' | 'json';
import { dictApi, execApi, connectionApi, errorMessage, type DictTable, type DictColumn, type DbConnection } from '../api/client';

type View = 'ddl' | 'data';
type InputMode = 'direct' | 'mapping';

export default function DdlPage() {
  const [tables, setTables] = useState<Table[]>([newTable('SAMPLE_TABLE')]);
  const [sel, setSel] = useState(0);
  const [dialect, setDialect] = useState<Dialect>('oracle');
  const [opt, setOpt] = useState<DdlOptions>(DEFAULT_OPTIONS);
  const [name, setName] = useState('Untitled');
  const [currentId, setCurrentId] = useState<string | null>(null);

  // 데이터 입력 모드
  const [view, setView] = useState<View>('ddl');
  const [dataByTable, setDataByTable] = useState<Record<string, Row[]>>({});
  const [genMode, setGenMode] = useState<DataMode>('insert');
  const [dataSql, setDataSql] = useState('');
  const fileRef = useRef<HTMLInputElement>(null);

  const nav = useNavigate();
  const loc = useLocation();
  // 스키마 브라우저에서 가져온 테이블 로딩
  useEffect(() => {
    const imp = (loc.state as { importTable?: Table } | null)?.importTable;
    if (imp) {
      setTables([imp]);
      setSel(0);
      setView('ddl');
      setName(imp.name || 'Untitled');
      setCurrentId(null);
      window.history.replaceState({}, ''); // 재마운트 시 재로딩 방지
      toast.success(`'${imp.name}' 테이블을 가져왔습니다.`);
    }
    // eslint-disable-next-line
  }, []);
  // 표준 사전 매핑
  const [inputMode, setInputMode] = useState<InputMode>('direct');
  const [dictTables, setDictTables] = useState<DictTable[]>([]);
  const [dictColumns, setDictColumns] = useState<DictColumn[]>([]);
  const reloadDict = async () => {
    try {
      setDictTables(await dictApi.listTables());
      setDictColumns(await dictApi.listColumns());
    } catch (e) { toast.error(errorMessage(e)); }
  };
  // DB 실행 대상 연결
  const [connections, setConnections] = useState<DbConnection[]>([]);
  const [execConn, setExecConn] = useState(''); // '' = 앱 기본 DB
  useEffect(() => {
    reloadDict();
    connectionApi.list().then(setConnections).catch(() => {});
    /* eslint-disable-next-line */
  }, []);

  // 저장/복원 — 테이블 정의 + dialect + 옵션 + 입력데이터를 JSON으로 보관
  const getContent = () => JSON.stringify({ tables, dialect, opt, data: dataByTable });
  const onLoad = (content: string) => {
    if (!content) {
      setTables([newTable('SAMPLE_TABLE')]); setSel(0); setDataByTable({}); setDataSql(''); return;
    }
    try {
      const d = JSON.parse(content);
      const ts: Table[] = Array.isArray(d.tables) && d.tables.length ? d.tables : [newTable('SAMPLE_TABLE')];
      setTables(ts);
      setSel(0);
      setDataByTable(d.data && typeof d.data === 'object' ? d.data : {});
      setDataSql('');
      if (d.dialect) setDialect(d.dialect);
      if (d.opt) setOpt({ ...DEFAULT_OPTIONS, ...d.opt });
    } catch {
      toast.error('불러오기에 실패했습니다 (형식 오류).');
    }
  };

  const table = tables[sel];
  const currentRows = dataByTable[table.name]?.length ? dataByTable[table.name] : [{}];
  const setCurrentRows = (rows: Row[]) => setDataByTable((m) => ({ ...m, [table.name]: rows }));

  const ddl = useMemo(() => generateDDL(tables, dialect, opt), [tables, dialect, opt]);
  const dataErrors = useMemo(() => countErrors(table, currentRows), [table, currentRows]);

  // 엑셀 업로드 → 그리드 채우기 (1행이 헤더(컬럼명)면 매핑, 아니면 컬럼 순서대로)
  const onExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const XLSX = await import('xlsx'); // 동적 로드 (엑셀 업로드 시에만)
      const buf = await f.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' });
      if (aoa.length === 0) { toast.error('빈 시트입니다.'); return; }
      const cols = table.columns.filter((c) => c.name.trim());
      const nameToIdx: Record<string, number> = {};
      cols.forEach((c, i) => { nameToIdx[c.name.toLowerCase()] = i; });
      const first = (aoa[0] || []).map((x) => String(x).toLowerCase().trim());
      const isHeader = first.some((h) => h in nameToIdx);
      // 헤더면 헤더 위치→컬럼 매핑, 아니면 위치 그대로
      const colOfExcel: (number | null)[] = isHeader
        ? first.map((h) => (h in nameToIdx ? nameToIdx[h] : null))
        : cols.map((_, i) => i);
      const body = isHeader ? aoa.slice(1) : aoa;
      const rows: Row[] = body
        .filter((line) => line.some((v) => String(v).trim() !== ''))
        .map((line) => {
          const r: Row = {};
          line.forEach((val, ci) => {
            const target = colOfExcel[ci];
            if (target != null && cols[target]) r[cols[target].id] = String(val);
          });
          return r;
        });
      setCurrentRows(rows.length ? rows : [{}]);
      setView('data');
      toast.success(`${rows.length}행을 불러왔습니다${isHeader ? ' (헤더 매핑)' : ' (컬럼 순서)'}.`);
    } catch {
      toast.error('엑셀 파싱에 실패했습니다.');
    } finally {
      e.target.value = '';
    }
  };

  const genData = () => {
    if (genMode === 'json') {
      const { json, error } = generateJson(table, currentRows);
      if (error) { setDataSql(''); toast.error(error); return; }
      setDataSql(json);
      if (dataErrors > 0) toast(`검증 오류 ${dataErrors}건이 포함되어 있습니다.`, { icon: '⚠️' });
      else toast.success('JSON을 생성했습니다.');
      return;
    }
    const { sql, error } = generateDML(table, currentRows, dialect, genMode, opt.quoteIdentifiers);
    if (error) { setDataSql(''); toast.error(error); return; }
    setDataSql(sql);
    if (dataErrors > 0) toast(`검증 오류 ${dataErrors}건이 포함되어 있습니다.`, { icon: '⚠️' });
    else toast.success('SQL을 생성했습니다.');
  };

  const copyData = async () => {
    if (!dataSql) return toast.error('생성된 SQL이 없습니다.');
    await navigator.clipboard.writeText(dataSql);
    toast.success('복사했습니다.');
  };

  const [running, setRunning] = useState(false);
  const runOnDb = async () => {
    if (!dataSql) return toast.error('먼저 [SQL 생성]을 누르세요.');
    if (dataErrors > 0 && !confirm(`검증 오류 ${dataErrors}건이 있습니다. 그래도 실행할까요?`)) return;
    const target = execConn ? (connections.find((c) => c.id === execConn)?.name || '선택한 연결') : '앱 기본 DB';
    if (!confirm(`생성된 SQL을 [${target}]에 직접 실행합니다. 계속할까요?\n(실패 시 전체 롤백)`)) return;
    setRunning(true);
    try {
      const r = await execApi.run(dataSql, execConn);
      toast.success(`실행 완료 · ${r.statements}개 문장 · ${r.affected}건 반영`);
    } catch (e) {
      toast.error(errorMessage(e));
    } finally {
      setRunning(false);
    }
  };

  const patchTable = (patch: Partial<Table>) =>
    setTables((ts) => ts.map((t, i) => (i === sel ? { ...t, ...patch } : t)));

  const patchColumn = (cid: string, patch: Partial<Column>) =>
    patchTable({ columns: table.columns.map((c) => (c.id === cid ? { ...c, ...patch } : c)) });

  const addColumn = () => patchTable({ columns: [...table.columns, newColumn()] });

  // 사전 매핑: 표준 테이블/컬럼 선택 → 현재 테이블에 반영
  const selectDictTable = (dt: DictTable) =>
    patchTable({ name: dt.table_cd, schema: dt.schema_nm || '', comment: dt.comment || dt.table_nm || '' });
  const addColumnFromDict = (dc: DictColumn) => {
    const type = (BASE_TYPES.includes(dc.col_type as BaseType) ? dc.col_type : 'VARCHAR') as BaseType;
    patchTable({ columns: [...table.columns, newColumn({
      name: dc.column_cd, type, length: dc.col_length || '', comment: dc.column_nm || dc.comment || '',
    })] });
  };
  const removeColumn = (cid: string) =>
    patchTable({ columns: table.columns.filter((c) => c.id !== cid) });
  const moveColumn = (idx: number, dir: -1 | 1) => {
    const next = [...table.columns];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    patchTable({ columns: next });
  };

  const addTable = () => {
    setTables((ts) => [...ts, newTable(`TABLE_${ts.length + 1}`)]);
    setSel(tables.length);
  };
  const removeTable = (idx: number) => {
    if (tables.length === 1) return;
    setTables((ts) => ts.filter((_, i) => i !== idx));
    setSel((s) => (s >= idx && s > 0 ? s - 1 : s));
  };

  const copyDDL = async () => {
    if (!ddl) return toast.error('생성된 DDL이 없습니다.');
    await navigator.clipboard.writeText(ddl);
    toast.success('DDL을 복사했습니다.');
  };

  const seg = 'px-3 py-1 rounded text-xs font-medium transition-colors whitespace-nowrap';
  const actions = (
    <>
      <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#243149] rounded p-0.5 shrink-0">
        {(['ddl', 'data'] as View[]).map((v) => (
          <button key={v} onClick={() => setView(v)}
            className={`${seg} ${view === v ? 'bg-white dark:bg-[#0F1A2D] text-dk-blue shadow-sm' : 'text-gray-500 dark:text-gray-300 hover:text-gray-700'}`}>
            {v === 'ddl' ? 'DDL 생성' : '데이터 입력'}
          </button>
        ))}
      </div>
      {view === 'ddl' && (
        <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#243149] rounded p-0.5 shrink-0">
          {(['direct', 'mapping'] as InputMode[]).map((m) => (
            <button key={m} onClick={() => setInputMode(m)}
              className={`${seg} ${inputMode === m ? 'bg-white dark:bg-[#0F1A2D] text-dk-blue shadow-sm' : 'text-gray-500 dark:text-gray-300 hover:text-gray-700'}`}>
              {m === 'direct' ? '직접 입력' : '사전 매핑'}
            </button>
          ))}
        </div>
      )}
      {view === 'ddl' && (
        <button className="dk-btn-secondary shrink-0 whitespace-nowrap" onClick={() => nav('/dict')}>사전 관리</button>
      )}
      <select className="dk-input !py-1.5 shrink-0" value={dialect} onChange={(e) => setDialect(e.target.value as Dialect)}>
        {DIALECTS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
      </select>
      {view === 'ddl'
        ? <button className="dk-btn-primary shrink-0 whitespace-nowrap" onClick={copyDDL}>DDL 복사</button>
        : <button className="dk-btn-primary shrink-0 whitespace-nowrap" onClick={genData}>{genMode === 'json' ? 'JSON 생성' : 'SQL 생성'}</button>}
      <ProjectControls
        type="ddl" name={name} setName={setName}
        currentId={currentId} setCurrentId={setCurrentId}
        getContent={getContent} onLoad={onLoad}
      />
    </>
  );

  return (
    <Layout title="DDL 생성" subtitle="테이블·컬럼 정의 → CREATE TABLE · [데이터 입력] 탭에서 그리드/붙여넣기/엑셀 → INSERT·UPDATE 생성" actions={actions}>
      <div className="flex gap-4 h-full">
        {/* 테이블 목록 */}
        <div className="w-44 shrink-0 dk-card p-2 flex flex-col">
          <div className="flex items-center justify-between px-1 mb-1">
            <span className="text-xs font-bold text-gray-500 dark:text-gray-300">테이블</span>
            <button className="text-dk-blue hover:bg-gray-100 dark:hover:bg-white/10 rounded w-6 h-6 text-lg leading-none" onClick={addTable}>+</button>
          </div>
          <div className="flex-1 overflow-auto space-y-0.5">
            {tables.map((t, i) => (
              <div
                key={i}
                onClick={() => setSel(i)}
                className={`group flex items-center justify-between px-2 py-1.5 rounded cursor-pointer text-sm ${
                  i === sel ? 'bg-dk-blue/10 text-dk-blue font-medium' : 'hover:bg-gray-100 dark:hover:bg-white/10 text-gray-600 dark:text-gray-300'
                }`}
              >
                <span className="truncate">{t.name || '(이름 없음)'}</span>
                {tables.length > 1 && (
                  <button
                    onClick={(e) => { e.stopPropagation(); removeTable(i); }}
                    className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-dk-red text-xs"
                  >✕</button>
                )}
              </div>
            ))}
          </div>
        </div>

        {view === 'data' ? (
          <>
            {/* 데이터 입력 그리드 */}
            <div className="flex-1 min-w-0 dk-card p-4 flex flex-col overflow-hidden">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-sm font-bold text-gray-600 dark:text-gray-200">{table.name || '(테이블)'}</span>
                <span className="text-xs text-gray-400">데이터 입력</span>
                <span className="flex-1" />
                <button className="dk-btn-secondary !py-1.5 text-xs" onClick={() => fileRef.current?.click()}>엑셀 업로드</button>
                <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onExcel} />
                {dataErrors > 0 && <span className="text-xs text-dk-red font-medium">검증 오류 {dataErrors}건</span>}
              </div>
              <div className="flex-1 min-h-0">
                <DataEntryGrid table={table} rows={currentRows} setRows={setCurrentRows} dialect={dialect} />
              </div>
            </div>
            {/* 데이터 SQL 출력 */}
            <div className="w-[38%] shrink-0 dk-card flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-[#1b2942] border-b border-gray-100 dark:border-[#243149] text-xs font-semibold text-gray-600 dark:text-gray-200">
                <span>{genMode === 'json' ? '생성된 JSON' : `생성된 SQL · ${DIALECTS.find((d) => d.id === dialect)?.label}`}</span>
                <div className="flex items-center gap-1 bg-gray-100 dark:bg-[#243149] rounded p-0.5 font-normal">
                  {(['insert', 'update', 'json'] as DataMode[]).map((m) => (
                    <button key={m} onClick={() => setGenMode(m)}
                      className={`px-2 py-0.5 rounded text-[11px] ${genMode === m ? 'bg-white dark:bg-[#0F1A2D] text-dk-blue shadow-sm' : 'text-gray-500 dark:text-gray-300'}`}>
                      {m.toUpperCase()}
                    </button>
                  ))}
                  <button className="ml-1 text-gray-500 dark:text-gray-300 hover:text-dk-blue px-1" onClick={copyData}>복사</button>
                  {genMode !== 'json' && (
                    <>
                      <select className="dk-input !py-0.5 text-[11px] ml-1" value={execConn} onChange={(e) => setExecConn(e.target.value)} title="실행 대상 DB">
                        <option value="">앱 기본 DB</option>
                        {connections.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                      <button className="text-dk-orange hover:underline px-1 disabled:opacity-50" disabled={running} onClick={runOnDb}>DB 실행</button>
                      <button className="text-gray-400 hover:text-dk-blue px-1" title="연결 관리" onClick={() => nav('/connections')}>⚙</button>
                    </>
                  )}
                </div>
              </div>
              <pre className="flex-1 min-h-0 overflow-auto p-3.5 font-mono text-[12.5px] leading-relaxed whitespace-pre bg-[#0f172a] text-[#e2e8f0]">
                {dataSql || (genMode === 'json'
                  ? `// 데이터를 입력하고 [SQL 생성]을 누르면\n// 컬럼 타입에 맞춰 JSON 배열로 출력됩니다.\n// 숫자/불리언은 타입대로, 빈 값은 null.`
                  : `// 데이터를 입력하고 [SQL 생성]을 누르세요.\n// ${genMode === 'update' ? 'UPDATE는 PK 컬럼 기준으로 생성됩니다.' : 'INSERT 문이 행마다 생성됩니다.'}\n// [DB 실행]은 앱이 연결된 DB에 직접 적용합니다(주의).`)}
              </pre>
            </div>
          </>
        ) : (
        <>
        {/* 에디터 */}
        <div className="flex-1 min-w-0 dk-card p-4 flex flex-col overflow-hidden">
          {inputMode === 'mapping' && (
            <div className="mb-3 p-3 rounded-lg bg-dk-blue/5 border border-dk-blue/20 space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-dk-blue w-20 shrink-0">표준 테이블</span>
                <SearchSelect
                  className="flex-1"
                  placeholder="사전에서 테이블 검색·선택…"
                  value={dictTables.find((d) => d.table_cd === table.name)?.id || ''}
                  options={dictTables.map((d) => ({ value: d.id, label: `${d.table_cd}${d.table_nm ? ` — ${d.table_nm}` : ''}` }))}
                  onSelect={(id) => { const d = dictTables.find((x) => x.id === id); if (d) selectDictTable(d); }}
                />
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-dk-blue w-20 shrink-0">표준 컬럼</span>
                <SearchSelect
                  className="flex-1"
                  resetOnSelect
                  placeholder="사전에서 컬럼 검색·추가… (선택 시 행 추가)"
                  options={dictColumns.map((c) => ({ value: c.id, label: `${c.column_cd}${c.column_nm ? ` — ${c.column_nm}` : ''} [${c.col_type}${c.col_length ? `(${c.col_length})` : ''}]` }))}
                  onSelect={(id) => { const c = dictColumns.find((x) => x.id === id); if (c) addColumnFromDict(c); }}
                />
              </div>
              {(dictTables.length === 0 && dictColumns.length === 0) && (
                <p className="text-[11px] text-gray-500">사전이 비어 있습니다. 우측 상단 [사전 관리]에서 표준 테이블/컬럼을 등록하세요.</p>
              )}
            </div>
          )}
          <div className="flex gap-2 mb-3">
            <input className="dk-input flex-1" placeholder="테이블명" value={table.name}
              onChange={(e) => patchTable({ name: e.target.value })} />
            <input className="dk-input w-32" placeholder="스키마(선택)" value={table.schema}
              onChange={(e) => patchTable({ schema: e.target.value })} />
            <input className="dk-input flex-1" placeholder="테이블 설명(주석)" value={table.comment}
              onChange={(e) => patchTable({ comment: e.target.value })} />
          </div>

          <div className="flex-1 overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 text-xs text-gray-500">
                <tr>
                  <th className="w-8"></th>
                  <th className="text-left px-2 py-1.5 font-medium">컬럼명</th>
                  <th className="text-left px-2 py-1.5 font-medium w-28">타입</th>
                  <th className="text-left px-2 py-1.5 font-medium w-20">길이</th>
                  <th className="px-1 py-1.5 font-medium w-10">PK</th>
                  <th className="px-1 py-1.5 font-medium w-12">NN</th>
                  <th className="px-1 py-1.5 font-medium w-10">UQ</th>
                  <th className="text-left px-2 py-1.5 font-medium w-24">기본값</th>
                  <th className="text-left px-2 py-1.5 font-medium">주석</th>
                  <th className="w-16"></th>
                </tr>
              </thead>
              <tbody>
                {table.columns.map((c, idx) => (
                  <tr key={c.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                    <td className="text-center text-gray-300 text-xs">{idx + 1}</td>
                    <td className="px-1 py-1">
                      <input className="dk-input w-full !py-1" value={c.name}
                        onChange={(e) => patchColumn(c.id, { name: e.target.value })} placeholder="COL_NAME" />
                    </td>
                    <td className="px-1 py-1">
                      <select className="dk-input w-full !py-1" value={c.type}
                        onChange={(e) => patchColumn(c.id, { type: e.target.value as Column['type'] })}>
                        {BASE_TYPES.map((t) => <option key={t} value={t}>{physicalTypeName(t, dialect)}</option>)}
                      </select>
                    </td>
                    <td className="px-1 py-1">
                      <input className="dk-input w-full !py-1 disabled:bg-gray-50 disabled:text-gray-300"
                        value={c.length} disabled={!TYPES_WITH_LENGTH.includes(c.type)}
                        onChange={(e) => patchColumn(c.id, { length: e.target.value })}
                        placeholder={c.type === 'DECIMAL' ? '18,2' : '100'} />
                    </td>
                    <td className="text-center">
                      <input type="checkbox" checked={c.pk}
                        onChange={(e) => patchColumn(c.id, { pk: e.target.checked })} />
                    </td>
                    <td className="text-center">
                      <input type="checkbox" checked={c.notNull || c.pk} disabled={c.pk}
                        onChange={(e) => patchColumn(c.id, { notNull: e.target.checked })} />
                    </td>
                    <td className="text-center">
                      <input type="checkbox" checked={c.unique || false} disabled={c.pk}
                        onChange={(e) => patchColumn(c.id, { unique: e.target.checked })} />
                    </td>
                    <td className="px-1 py-1">
                      <input className="dk-input w-full !py-1" value={c.defaultValue}
                        onChange={(e) => patchColumn(c.id, { defaultValue: e.target.value })} />
                    </td>
                    <td className="px-1 py-1">
                      <input className="dk-input w-full !py-1" value={c.comment}
                        onChange={(e) => patchColumn(c.id, { comment: e.target.value })} />
                    </td>
                    <td className="text-center whitespace-nowrap">
                      <button className="text-gray-300 hover:text-gray-600 px-1" onClick={() => moveColumn(idx, -1)}>▲</button>
                      <button className="text-gray-300 hover:text-gray-600 px-1" onClick={() => moveColumn(idx, 1)}>▼</button>
                      <button className="text-gray-300 hover:text-dk-red px-1" onClick={() => removeColumn(c.id)}>✕</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <button className="dk-btn-secondary mt-3 self-start" onClick={addColumn}>+ 컬럼 추가</button>
          <IndexEditor table={table} onChange={(indexes) => patchTable({ indexes })} />
        </div>

        {/* 출력 */}
        <div className="w-[38%] shrink-0 dk-card flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-600">
            <span>생성된 DDL · {DIALECTS.find((d) => d.id === dialect)?.label}</span>
            <div className="flex items-center gap-2 font-normal">
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={opt.quoteIdentifiers}
                  onChange={(e) => setOpt({ ...opt, quoteIdentifiers: e.target.checked })} /> 인용
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={opt.includeComments}
                  onChange={(e) => setOpt({ ...opt, includeComments: e.target.checked })} /> 주석
              </label>
              <label className="flex items-center gap-1 cursor-pointer">
                <input type="checkbox" checked={opt.includeDrop}
                  onChange={(e) => setOpt({ ...opt, includeDrop: e.target.checked })} /> DROP
              </label>
            </div>
          </div>
          <pre className="flex-1 min-h-0 overflow-auto p-3.5 font-mono text-[12.5px] leading-relaxed whitespace-pre bg-[#0f172a] text-[#e2e8f0]">
            {ddl || '// 테이블명과 컬럼을 입력하면 DDL이 생성됩니다.'}
          </pre>
        </div>
        </>
        )}
      </div>
    </Layout>
  );
}
