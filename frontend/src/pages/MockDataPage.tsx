import { useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import { DIALECTS, type Dialect } from '../lib/ddl';
import {
  GEN_TYPES, generateRows, toInsertSQL, toCSV, toJSON,
  type MockColumn, type GenType,
} from '../lib/mockgen';

type OutFmt = 'sql' | 'csv' | 'tsv' | 'json';

let seq = 0;
const uid = () => `c${Date.now().toString(36)}${seq++}`;

const newCol = (name: string, type: GenType, extra: Partial<MockColumn> = {}): MockColumn =>
  ({ id: uid(), name, type, ...extra });

// 시작 시 보여줄 샘플(직원 테이블)
const SAMPLE = (): MockColumn[] => [
  newCol('EMP_NO', 'empNo', { prefix: 'E', min: '1', digits: '5' }),
  newCol('EMP_NM', 'krName'),
  newCol('DEPT_NM', 'dept'),
  newCol('EMAIL', 'email'),
  newCol('PHONE', 'phone'),
  newCol('HIRE_DT', 'date', { from: '2018-01-01', to: '2025-12-31' }),
  newCol('SALARY', 'decimal', { min: '3000', max: '12000', scale: '0' }),
  newCol('USE_YN', 'bool', { boolStyle: 'YN' }),
];

const countLines = (s: string) => (s ? s.split('\n').length : 0);

export default function MockDataPage() {
  const [cols, setCols] = useState<MockColumn[]>(SAMPLE);
  const [rowCount, setRowCount] = useState(20);
  const [fmt, setFmt] = useState<OutFmt>('sql');
  const [dialect, setDialect] = useState<Dialect>('oracle');
  const [table, setTable] = useState('TB_EMPLOYEE');
  const [quoteIds, setQuoteIds] = useState(false);
  const [output, setOutput] = useState('');

  const patch = (id: string, p: Partial<MockColumn>) =>
    setCols((a) => a.map((c) => (c.id === id ? { ...c, ...p } : c)));
  const addCol = () => setCols((a) => [...a, newCol('', 'string')]);
  const delCol = (id: string) => setCols((a) => a.filter((c) => c.id !== id));
  const moveCol = (id: string, dir: -1 | 1) =>
    setCols((a) => {
      const i = a.findIndex((c) => c.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= a.length) return a;
      const copy = a.slice();
      [copy[i], copy[j]] = [copy[j], copy[i]];
      return copy;
    });

  const generate = () => {
    const named = cols.filter((c) => c.name.trim());
    if (named.length === 0) return toast.error('컬럼을 1개 이상 정의하세요.');
    if (fmt === 'sql' && !table.trim()) return toast.error('테이블명을 입력하세요.');
    const n = Math.max(1, Math.min(rowCount || 0, 100000));
    const rows = generateRows(cols, n);
    let out = '';
    if (fmt === 'sql') out = toInsertSQL(cols, rows, { table, dialect, quoteIds });
    else if (fmt === 'csv') out = toCSV(cols, rows, ',');
    else if (fmt === 'tsv') out = toCSV(cols, rows, '\t');
    else out = toJSON(cols, rows);
    setOutput(out);
    toast.success(`${n}행 생성 완료`);
  };

  const copy = async () => {
    if (!output) return toast.error('생성된 결과가 없습니다.');
    try { await navigator.clipboard.writeText(output); toast.success('복사했습니다.'); }
    catch { toast.error('복사 실패'); }
  };
  const download = () => {
    if (!output) return toast.error('생성된 결과가 없습니다.');
    const ext = fmt === 'sql' ? 'sql' : fmt === 'json' ? 'json' : fmt === 'tsv' ? 'txt' : 'csv';
    const mime = fmt === 'json' ? 'application/json' : fmt === 'sql' ? 'text/plain' : 'text/csv';
    const bom = fmt === 'csv' ? '﻿' : '';
    const blob = new Blob([bom + output], { type: `${mime};charset=utf-8` });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `mockdata.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const actions = (
    <>
      <button className="dk-btn-ghost" onClick={() => { setCols(SAMPLE()); setOutput(''); }}>샘플</button>
      <button className="dk-btn-ghost" onClick={() => { setCols([newCol('', 'string')]); setOutput(''); }}>비우기</button>
      <button className="dk-btn-secondary" onClick={copy} disabled={!output}>복사</button>
      <button className="dk-btn-secondary" onClick={download} disabled={!output}>다운로드</button>
      <button className="dk-btn-primary whitespace-nowrap" onClick={generate}>생성</button>
    </>
  );

  return (
    <Layout title="더미 데이터 생성기" subtitle="컬럼 정의 → 랜덤 데이터 → SQL INSERT · CSV · JSON · TSV" actions={actions}>
      <div className="flex flex-col lg:flex-row h-full gap-3">
        {/* 좌: 컬럼 정의 + 출력 옵션 */}
        <div className="lg:w-[560px] shrink-0 flex flex-col gap-3 min-h-0">
          {/* 출력 옵션 */}
          <div className="dk-card p-3 space-y-2 shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              <label className="text-xs text-gray-500 dark:text-gray-300">행 수</label>
              <input type="number" min={1} max={100000} value={rowCount}
                onChange={(e) => setRowCount(parseInt(e.target.value, 10) || 0)}
                className="dk-input !py-1 w-24 text-sm" />
              <label className="text-xs text-gray-500 dark:text-gray-300 ml-2">형식</label>
              <select className="dk-input !py-1 text-sm" value={fmt} onChange={(e) => setFmt(e.target.value as OutFmt)}>
                <option value="sql">SQL INSERT</option>
                <option value="csv">CSV</option>
                <option value="tsv">TSV</option>
                <option value="json">JSON</option>
              </select>
            </div>
            {fmt === 'sql' && (
              <div className="flex items-center gap-2 flex-wrap">
                <input className="dk-input !py-1 text-sm flex-1 min-w-[140px]" placeholder="테이블명 (예: TB_EMPLOYEE)"
                  value={table} onChange={(e) => setTable(e.target.value)} />
                <select className="dk-input !py-1 text-sm" value={dialect} onChange={(e) => setDialect(e.target.value as Dialect)}>
                  {DIALECTS.map((d) => <option key={d.id} value={d.id}>{d.label}</option>)}
                </select>
                <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-300 cursor-pointer select-none">
                  <input type="checkbox" className="accent-dk-blue" checked={quoteIds} onChange={(e) => setQuoteIds(e.target.checked)} />
                  식별자 따옴표
                </label>
              </div>
            )}
          </div>

          {/* 컬럼 목록 */}
          <div className="dk-card flex flex-col overflow-hidden flex-1 min-h-0">
            <div className="flex items-center justify-between px-3 py-2 bg-gray-50 dark:bg-[#1b2942] border-b border-gray-100 dark:border-[#243149] text-xs font-semibold text-gray-600 dark:text-gray-200">
              <span>컬럼 정의 ({cols.filter((c) => c.name.trim()).length})</span>
              <button className="dk-btn-ghost !py-0.5 !px-2 text-xs" onClick={addCol}>+ 컬럼</button>
            </div>
            <div className="overflow-auto flex-1 min-h-0 p-2 space-y-2">
              {cols.map((c) => (
                <div key={c.id} className="border border-gray-100 dark:border-[#243149] rounded p-2 space-y-1.5">
                  <div className="flex items-center gap-1.5">
                    <input className="dk-input !py-1 text-sm flex-1 min-w-0 font-mono" placeholder="컬럼명"
                      value={c.name} onChange={(e) => patch(c.id, { name: e.target.value })} />
                    <select className="dk-input !py-1 text-sm w-32 shrink-0" value={c.type}
                      onChange={(e) => patch(c.id, { type: e.target.value as GenType })}>
                      {GEN_TYPES.map((g) => <option key={g.id} value={g.id}>{g.label}</option>)}
                    </select>
                    <button className="dk-btn-ghost !px-1.5 !py-1 text-xs shrink-0" title="위로" onClick={() => moveCol(c.id, -1)}>↑</button>
                    <button className="dk-btn-ghost !px-1.5 !py-1 text-xs shrink-0" title="아래로" onClick={() => moveCol(c.id, 1)}>↓</button>
                    <button className="text-dk-red hover:underline text-xs px-1 shrink-0" onClick={() => delCol(c.id)}>삭제</button>
                  </div>
                  <ColOptions col={c} patch={(p) => patch(c.id, p)} />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* 우: 결과 */}
        <div className="dk-card flex flex-col overflow-hidden flex-1 min-h-0">
          <div className="flex items-center justify-between px-4 py-2 bg-gray-50 dark:bg-[#1b2942] border-b border-gray-100 dark:border-[#243149] text-xs font-semibold text-gray-600 dark:text-gray-200">
            <span>결과 ({fmt.toUpperCase()})</span>
            <span className="font-normal text-gray-400">{countLines(output)}줄</span>
          </div>
          <textarea readOnly value={output} spellCheck={false}
            placeholder="좌측에서 컬럼을 정의하고 [생성]을 누르세요."
            className="flex-1 min-h-0 w-full resize-none border-none outline-none p-3.5 font-mono text-[12.5px] leading-relaxed whitespace-pre overflow-auto bg-[#0f172a] text-[#e2e8f0]" />
        </div>
      </div>
    </Layout>
  );
}

// 타입별 옵션 입력
function ColOptions({ col, patch }: { col: MockColumn; patch: (p: Partial<MockColumn>) => void }) {
  const t = col.type;
  const num = (k: keyof MockColumn, ph: string, w = 'w-20') => (
    <input className={`dk-input !py-0.5 text-xs ${w}`} placeholder={ph}
      value={(col[k] as string) ?? ''} onChange={(e) => patch({ [k]: e.target.value })} />
  );
  const opts: React.ReactNode[] = [];
  if (t === 'seq') opts.push(num('min', '시작', 'w-16'), num('digits', '자릿수', 'w-16'));
  if (t === 'int') opts.push(num('min', '최소', 'w-16'), num('max', '최대', 'w-16'));
  if (t === 'decimal') opts.push(num('min', '최소', 'w-16'), num('max', '최대', 'w-16'), num('scale', '소수', 'w-14'));
  if (t === 'empNo') opts.push(num('prefix', '접두(E)', 'w-16'), num('min', '시작', 'w-14'), num('digits', '자릿수', 'w-14'));
  if (t === 'string') opts.push(num('digits', '길이', 'w-16'));
  if (t === 'date' || t === 'datetime') opts.push(num('from', '시작 YYYY-MM-DD', 'w-32'), num('to', '끝 YYYY-MM-DD', 'w-32'));
  if (t === 'bool') opts.push(
    <select key="bs" className="dk-input !py-0.5 text-xs w-24" value={col.boolStyle ?? 'YN'}
      onChange={(e) => patch({ boolStyle: e.target.value as MockColumn['boolStyle'] })}>
      <option value="YN">Y / N</option>
      <option value="TF">true/false</option>
      <option value="10">1 / 0</option>
    </select>,
  );
  if (t === 'list') opts.push(
    <input key="ls" className="dk-input !py-0.5 text-xs flex-1 min-w-[160px]" placeholder="값1, 값2, 값3 (쉼표 구분)"
      value={col.list ?? ''} onChange={(e) => patch({ list: e.target.value })} />,
  );
  if (t === 'fixed') opts.push(
    <input key="fx" className="dk-input !py-0.5 text-xs flex-1 min-w-[160px]" placeholder="고정값"
      value={col.list ?? ''} onChange={(e) => patch({ list: e.target.value })} />,
  );

  // NULL 비율은 모든 타입 공통
  opts.push(
    <label key="np" className="flex items-center gap-1 text-[11px] text-gray-400 ml-auto">
      NULL%
      <input className="dk-input !py-0.5 text-xs w-12" placeholder="0" value={col.nullPct ?? ''}
        onChange={(e) => patch({ nullPct: e.target.value })} />
    </label>,
  );

  return <div className="flex items-center gap-1.5 flex-wrap">{opts}</div>;
}
