import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import { dictApi, errorMessage, type DictTable, type DictColumn } from '../api/client';
import { BASE_TYPES } from '../lib/ddl';

type Tab = 'tables' | 'columns';

export default function DictPage() {
  const nav = useNavigate();
  const [tab, setTab] = useState<Tab>('tables');
  const [tbls, setTbls] = useState<DictTable[]>([]);
  const [cols, setCols] = useState<DictColumn[]>([]);
  const [nt, setNt] = useState({ tableCd: '', tableNm: '', schemaNm: '', comment: '' });
  const [nc, setNc] = useState({ columnCd: '', columnNm: '', colType: 'VARCHAR', colLength: '', comment: '' });
  const [bulkText, setBulkText] = useState('');
  const [hasHeader, setHasHeader] = useState(false);
  const [showBulk, setShowBulk] = useState(false);

  const reload = async () => {
    try { setTbls(await dictApi.listTables()); setCols(await dictApi.listColumns()); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  useEffect(() => { reload(); /* eslint-disable-next-line */ }, []);

  // 단건 추가/수정/삭제
  const addTable = async () => {
    if (!nt.tableCd.trim()) return toast.error('테이블 코드를 입력하세요.');
    try { await dictApi.addTable(nt); setNt({ tableCd: '', tableNm: '', schemaNm: '', comment: '' }); reload(); toast.success('추가했습니다.'); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  const saveTable = async (t: DictTable) => {
    try { await dictApi.updTable(t.id, { tableCd: t.table_cd, tableNm: t.table_nm, schemaNm: t.schema_nm, comment: t.comment }); toast.success('저장했습니다.'); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  const delTable = async (id: string) => { try { await dictApi.delTable(id); reload(); } catch (e) { toast.error(errorMessage(e)); } };

  const addColumn = async () => {
    if (!nc.columnCd.trim()) return toast.error('컬럼 코드를 입력하세요.');
    try { await dictApi.addColumn(nc); setNc({ columnCd: '', columnNm: '', colType: 'VARCHAR', colLength: '', comment: '' }); reload(); toast.success('추가했습니다.'); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  const saveColumn = async (c: DictColumn) => {
    try { await dictApi.updColumn(c.id, { columnCd: c.column_cd, columnNm: c.column_nm, colType: c.col_type, colLength: c.col_length, comment: c.comment }); toast.success('저장했습니다.'); }
    catch (e) { toast.error(errorMessage(e)); }
  };
  const delColumn = async (id: string) => { try { await dictApi.delColumn(id); reload(); } catch (e) { toast.error(errorMessage(e)); } };

  const patchT = (id: string, p: Partial<DictTable>) => setTbls((a) => a.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const patchC = (id: string, p: Partial<DictColumn>) => setCols((a) => a.map((x) => (x.id === id ? { ...x, ...p } : x)));

  // 행 배열 → 일괄 등록
  const importRows = async (rows: string[][]) => {
    let body = hasHeader ? rows.slice(1) : rows;
    body = body.filter((r) => r.some((v) => String(v).trim() !== ''));
    if (body.length === 0) return toast.error('등록할 데이터가 없습니다.');
    try {
      if (tab === 'tables') {
        const r = await dictApi.bulkTables(body.map((c) => ({ tableCd: t(c, 0), tableNm: t(c, 1), schemaNm: t(c, 2), comment: t(c, 3) })));
        toast.success(`${r.inserted}건 등록했습니다.`);
      } else {
        const r = await dictApi.bulkColumns(body.map((c) => ({ columnCd: t(c, 0), columnNm: t(c, 1), colType: t(c, 2) || 'VARCHAR', colLength: t(c, 3), comment: t(c, 4) })));
        toast.success(`${r.inserted}건 등록했습니다.`);
      }
      setBulkText(''); setShowBulk(false); reload();
    } catch (e) { toast.error(errorMessage(e)); }
  };

  const applyPaste = () => {
    const cleaned = bulkText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n$/, '');
    if (!cleaned.trim()) return toast.error('붙여넣은 내용이 없습니다.');
    const rows = cleaned.split('\n').map((line) => (line.includes('\t') ? line.split('\t') : line.split(',')));
    importRows(rows);
  };

  const onExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      const XLSX = await import('xlsx');
      const wb = XLSX.read(await f.arrayBuffer(), { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const aoa = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, raw: false, defval: '' });
      importRows(aoa);
    } catch { toast.error('엑셀 파싱에 실패했습니다.'); }
    finally { e.target.value = ''; }
  };

  const actions = (
    <>
      <button className="dk-btn-secondary" onClick={() => setShowBulk((s) => !s)}>일괄 입력</button>
      <button className="dk-btn-primary" onClick={() => nav('/ddl')}>DDL로</button>
    </>
  );

  const placeholder = tab === 'tables'
    ? 'TB_USER\t사용자\t\t사용자 마스터\nTB_ORDER\t주문\t\t주문 테이블'
    : 'USER_CD\t사용자코드\tVARCHAR\t20\tPK\nAMT\t금액\tDECIMAL\t18,2\t';

  return (
    <Layout title="표준 사전 관리" subtitle="테이블명/컬럼명 표준을 관리 — DDL 생성의 [사전 매핑]에서 선택" actions={actions}>
      <div className="max-w-5xl space-y-4">
        <div className="flex items-center gap-1">
          {(['tables', 'columns'] as Tab[]).map((tb) => (
            <button key={tb} onClick={() => setTab(tb)}
              className={`px-3 py-1.5 rounded text-xs font-medium ${tab === tb ? 'bg-dk-blue text-white' : 'bg-gray-100 dark:bg-[#243149] text-gray-500 dark:text-gray-300'}`}>
              {tb === 'tables' ? `표준 테이블 (${tbls.length})` : `표준 컬럼 (${cols.length})`}
            </button>
          ))}
        </div>

        {showBulk && (
          <div className="dk-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-bold text-gray-600 dark:text-gray-200">일괄 입력 (붙여넣기 / 엑셀)</span>
              <label className="flex items-center gap-1 text-xs text-gray-500 dark:text-gray-300 cursor-pointer">
                <input type="checkbox" checked={hasHeader} onChange={(e) => setHasHeader(e.target.checked)} /> 첫 행은 헤더(제외)
              </label>
            </div>
            <p className="text-[11px] text-gray-400">
              {tab === 'tables' ? '열 순서: 테이블코드 · 테이블명 · 스키마 · 설명' : '열 순서: 컬럼코드 · 컬럼명 · 타입 · 길이 · 설명'} (Tab 또는 콤마 구분)
            </p>
            <textarea className="dk-input w-full font-mono text-xs h-28" placeholder={placeholder}
              value={bulkText} onChange={(e) => setBulkText(e.target.value)} />
            <div className="flex items-center gap-2">
              <button className="dk-btn-primary !py-1.5" onClick={applyPaste}>붙여넣기 적용</button>
              <label className="dk-btn-secondary !py-1.5 cursor-pointer">
                엑셀 업로드
                <input type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={onExcel} />
              </label>
            </div>
          </div>
        )}

        <div className="dk-card overflow-hidden">
          {tab === 'tables' ? (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#1b2942] text-xs text-gray-400">
                <tr><th className="text-left px-3 py-2">테이블 코드</th><th className="text-left px-3 py-2">테이블명(논리)</th><th className="text-left px-3 py-2">스키마</th><th className="text-left px-3 py-2">설명</th><th className="w-24"></th></tr>
              </thead>
              <tbody>
                <tr className="bg-dk-blue/5">
                  <td className="px-2 py-1"><input className="dk-input w-full !py-1" placeholder="TB_USER" value={nt.tableCd} onChange={(e) => setNt({ ...nt, tableCd: e.target.value })} /></td>
                  <td className="px-2 py-1"><input className="dk-input w-full !py-1" placeholder="사용자" value={nt.tableNm} onChange={(e) => setNt({ ...nt, tableNm: e.target.value })} /></td>
                  <td className="px-2 py-1"><input className="dk-input w-full !py-1" value={nt.schemaNm} onChange={(e) => setNt({ ...nt, schemaNm: e.target.value })} /></td>
                  <td className="px-2 py-1"><input className="dk-input w-full !py-1" value={nt.comment} onChange={(e) => setNt({ ...nt, comment: e.target.value })} /></td>
                  <td className="text-center"><button className="dk-btn-primary !py-1 text-xs" onClick={addTable}>추가</button></td>
                </tr>
                {tbls.map((t2) => (
                  <tr key={t2.id} className="border-t border-gray-50 dark:border-[#243149]">
                    <td className="px-2 py-1"><input className="dk-input w-full !py-1 font-mono" value={t2.table_cd} onChange={(e) => patchT(t2.id, { table_cd: e.target.value })} /></td>
                    <td className="px-2 py-1"><input className="dk-input w-full !py-1" value={t2.table_nm} onChange={(e) => patchT(t2.id, { table_nm: e.target.value })} /></td>
                    <td className="px-2 py-1"><input className="dk-input w-full !py-1" value={t2.schema_nm} onChange={(e) => patchT(t2.id, { schema_nm: e.target.value })} /></td>
                    <td className="px-2 py-1"><input className="dk-input w-full !py-1" value={t2.comment} onChange={(e) => patchT(t2.id, { comment: e.target.value })} /></td>
                    <td className="text-center whitespace-nowrap text-xs">
                      <button className="text-dk-blue hover:underline px-1" onClick={() => saveTable(t2)}>저장</button>
                      <button className="text-dk-red hover:underline px-1" onClick={() => delTable(t2.id)}>삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-gray-50 dark:bg-[#1b2942] text-xs text-gray-400">
                <tr><th className="text-left px-3 py-2">컬럼 코드</th><th className="text-left px-3 py-2">컬럼명(논리)</th><th className="text-left px-3 py-2 w-28">타입</th><th className="text-left px-3 py-2 w-20">길이</th><th className="text-left px-3 py-2">설명</th><th className="w-24"></th></tr>
              </thead>
              <tbody>
                <tr className="bg-dk-blue/5">
                  <td className="px-2 py-1"><input className="dk-input w-full !py-1" placeholder="USER_CD" value={nc.columnCd} onChange={(e) => setNc({ ...nc, columnCd: e.target.value })} /></td>
                  <td className="px-2 py-1"><input className="dk-input w-full !py-1" placeholder="사용자코드" value={nc.columnNm} onChange={(e) => setNc({ ...nc, columnNm: e.target.value })} /></td>
                  <td className="px-2 py-1"><select className="dk-input w-full !py-1" value={nc.colType} onChange={(e) => setNc({ ...nc, colType: e.target.value })}>{BASE_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}</select></td>
                  <td className="px-2 py-1"><input className="dk-input w-full !py-1" value={nc.colLength} onChange={(e) => setNc({ ...nc, colLength: e.target.value })} /></td>
                  <td className="px-2 py-1"><input className="dk-input w-full !py-1" value={nc.comment} onChange={(e) => setNc({ ...nc, comment: e.target.value })} /></td>
                  <td className="text-center"><button className="dk-btn-primary !py-1 text-xs" onClick={addColumn}>추가</button></td>
                </tr>
                {cols.map((c) => (
                  <tr key={c.id} className="border-t border-gray-50 dark:border-[#243149]">
                    <td className="px-2 py-1"><input className="dk-input w-full !py-1 font-mono" value={c.column_cd} onChange={(e) => patchC(c.id, { column_cd: e.target.value })} /></td>
                    <td className="px-2 py-1"><input className="dk-input w-full !py-1" value={c.column_nm} onChange={(e) => patchC(c.id, { column_nm: e.target.value })} /></td>
                    <td className="px-2 py-1"><select className="dk-input w-full !py-1" value={c.col_type} onChange={(e) => patchC(c.id, { col_type: e.target.value })}>{BASE_TYPES.map((x) => <option key={x} value={x}>{x}</option>)}</select></td>
                    <td className="px-2 py-1"><input className="dk-input w-full !py-1" value={c.col_length} onChange={(e) => patchC(c.id, { col_length: e.target.value })} /></td>
                    <td className="px-2 py-1"><input className="dk-input w-full !py-1" value={c.comment} onChange={(e) => patchC(c.id, { comment: e.target.value })} /></td>
                    <td className="text-center whitespace-nowrap text-xs">
                      <button className="text-dk-blue hover:underline px-1" onClick={() => saveColumn(c)}>저장</button>
                      <button className="text-dk-red hover:underline px-1" onClick={() => delColumn(c.id)}>삭제</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </Layout>
  );

  function t(arr: string[], i: number) { return String(arr[i] ?? '').trim(); }
}
