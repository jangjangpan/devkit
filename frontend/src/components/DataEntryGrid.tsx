import { Table, Dialect, physicalTypeName } from '../lib/ddl';
import { Row, validateCell, parseClipboardGrid } from '../lib/datagen';

interface Props {
  table: Table;
  rows: Row[];
  setRows: (rows: Row[]) => void;
  dialect: Dialect;
}

export default function DataEntryGrid({ table, rows, setRows, dialect }: Props) {
  const cols = table.columns.filter((c) => c.name.trim());

  const setCell = (ri: number, colId: string, value: string) => {
    const next = rows.map((r, i) => (i === ri ? { ...r, [colId]: value } : r));
    setRows(next);
  };

  const addRows = (n = 1) => setRows([...rows, ...Array.from({ length: n }, () => ({} as Row))]);
  const removeRow = (ri: number) => setRows(rows.filter((_, i) => i !== ri));
  const clearAll = () => setRows([{}]);

  // 붙여넣기: 클립보드가 여러 셀/행이면 시작 위치부터 채우고 행 자동 확장
  const onPaste = (e: React.ClipboardEvent, ri: number, ci: number) => {
    const text = e.clipboardData.getData('text');
    const grid = parseClipboardGrid(text);
    if (grid.length === 0) return;
    if (grid.length === 1 && grid[0].length === 1) return; // 단일 셀 → 기본 동작
    e.preventDefault();
    const next = rows.map((r) => ({ ...r }));
    grid.forEach((line, r) => {
      const targetRi = ri + r;
      while (next.length <= targetRi) next.push({});
      line.forEach((val, c) => {
        const col = cols[ci + c];
        if (col) next[targetRi][col.id] = val;
      });
    });
    setRows(next);
  };

  if (cols.length === 0) {
    return <div className="p-6 text-sm text-gray-400">먼저 [DDL 생성] 탭에서 테이블 컬럼을 정의하세요.</div>;
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 mb-2">
        <button className="dk-btn-secondary !py-1 text-xs" onClick={() => addRows(1)}>+ 행</button>
        <button className="dk-btn-secondary !py-1 text-xs" onClick={() => addRows(10)}>+ 10행</button>
        <button className="dk-btn-ghost !py-1 text-xs" onClick={clearAll}>전체 지우기</button>
        <span className="text-[11px] text-gray-400">셀에 Excel 영역을 복사 후 붙여넣기(Ctrl+V) 하면 자동 입력됩니다.</span>
      </div>
      <div className="flex-1 min-h-0 overflow-auto border border-gray-100 dark:border-[#243149] rounded">
        <table className="text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-gray-50 dark:bg-[#1b2942] text-xs text-gray-500 dark:text-gray-300">
            <tr>
              <th className="px-2 py-1.5 border border-gray-100 dark:border-[#243149] w-10">#</th>
              {cols.map((c) => (
                <th key={c.id} className="px-2 py-1.5 border border-gray-100 dark:border-[#243149] text-left whitespace-nowrap min-w-[120px]">
                  <span className="font-bold text-gray-700 dark:text-gray-100">{c.name}</span>
                  {(c.pk || c.notNull) && <span className="text-dk-red ml-0.5">*</span>}
                  <span className="ml-1 font-normal text-gray-400">
                    {physicalTypeName(c.type, dialect)}{c.length ? `(${c.length})` : ''}{c.pk ? ' PK' : ''}
                  </span>
                </th>
              ))}
              <th className="px-1 py-1.5 border border-gray-100 dark:border-[#243149] w-8"></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri}>
                <td className="px-2 py-0.5 border border-gray-100 dark:border-[#243149] text-center text-xs text-gray-300">{ri + 1}</td>
                {cols.map((c, ci) => {
                  const val = row[c.id] || '';
                  const err = validateCell(c, val);
                  return (
                    <td key={c.id} className="border border-gray-100 dark:border-[#243149] p-0">
                      <input
                        value={val}
                        onChange={(e) => setCell(ri, c.id, e.target.value)}
                        onPaste={(e) => onPaste(e, ri, ci)}
                        title={err || ''}
                        className={`w-full px-2 py-1 text-[13px] bg-transparent outline-none dark:text-gray-100 ${
                          err ? 'bg-dk-red/10 ring-1 ring-inset ring-dk-red/60' : 'focus:ring-1 focus:ring-inset focus:ring-dk-blue'
                        }`}
                      />
                    </td>
                  );
                })}
                <td className="border border-gray-100 dark:border-[#243149] text-center">
                  <button className="text-gray-300 hover:text-dk-red px-1" onClick={() => removeRow(ri)} disabled={rows.length <= 1}>✕</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
