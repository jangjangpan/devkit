import { Table, TableIndex, newIndex } from '../lib/ddl';

interface Props {
  table: Table;
  onChange: (indexes: TableIndex[]) => void;
}

// 테이블 인덱스(일반/UNIQUE) 편집기 — DDL 페이지와 ERD 패널에서 공용.
export default function IndexEditor({ table, onChange }: Props) {
  const indexes = table.indexes || [];
  const colNames = table.columns.map((c) => c.name).filter((n) => n.trim());

  const patch = (id: string, p: Partial<TableIndex>) =>
    onChange(indexes.map((ix) => (ix.id === id ? { ...ix, ...p } : ix)));
  const add = () => onChange([...indexes, newIndex()]);
  const remove = (id: string) => onChange(indexes.filter((ix) => ix.id !== id));
  const toggleCol = (ix: TableIndex, col: string) => {
    const has = ix.columns.includes(col);
    patch(ix.id, { columns: has ? ix.columns.filter((c) => c !== col) : [...ix.columns, col] });
  };

  return (
    <div className="mt-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xs font-bold text-gray-500 dark:text-gray-300">인덱스</span>
        <button className="text-dk-blue text-xs hover:underline" onClick={add}>+ 추가</button>
      </div>
      {indexes.length === 0 && <p className="text-[11px] text-gray-400">인덱스가 없습니다.</p>}
      <div className="space-y-2">
        {indexes.map((ix) => (
          <div key={ix.id} className="border border-gray-100 dark:border-[#243149] rounded p-2 space-y-1.5">
            <div className="flex items-center gap-2">
              <input className="dk-input !py-1 text-xs flex-1" placeholder="인덱스명 (비우면 자동)"
                value={ix.name} onChange={(e) => patch(ix.id, { name: e.target.value })} />
              <label className="flex items-center gap-1 text-xs text-gray-600 dark:text-gray-300 cursor-pointer whitespace-nowrap">
                <input type="checkbox" checked={ix.unique} onChange={(e) => patch(ix.id, { unique: e.target.checked })} /> UNIQUE
              </label>
              <button className="text-gray-300 hover:text-dk-red px-1" onClick={() => remove(ix.id)}>✕</button>
            </div>
            <div className="flex flex-wrap gap-1">
              {colNames.length === 0 && <span className="text-[11px] text-gray-400">컬럼을 먼저 정의하세요.</span>}
              {colNames.map((col) => {
                const on = ix.columns.includes(col);
                return (
                  <button key={col} onClick={() => toggleCol(ix, col)}
                    className={`text-[11px] px-2 py-0.5 rounded-full border ${
                      on ? 'bg-dk-blue text-white border-dk-blue' : 'border-gray-200 dark:border-[#2A3953] text-gray-500 dark:text-gray-300'
                    }`}>
                    {col}{on ? ` ${ix.columns.indexOf(col) + 1}` : ''}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
