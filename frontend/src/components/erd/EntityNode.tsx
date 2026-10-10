import { useContext } from 'react';
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { physicalTypeName, type Table } from '../../lib/ddl';
import { ErdDialectContext } from './dialectContext';

export interface EntityNodeData {
  table: Table;
  [key: string]: unknown;
}

// ERD 엔티티(테이블) 노드 — 헤더 + 컬럼 목록.
export default function EntityNode({ data, selected }: NodeProps) {
  const table = (data as EntityNodeData).table;
  const dialect = useContext(ErdDialectContext);
  return (
    <div
      className={`rounded-lg overflow-hidden shadow-md bg-white border-2 min-w-[180px] ${
        selected ? 'border-dk-blue' : 'border-gray-200'
      }`}
    >
      {/* 관계 연결용 핸들 (좌우) */}
      <Handle type="target" position={Position.Left} className="!bg-dk-cyan" />
      <Handle type="source" position={Position.Right} className="!bg-dk-blue" />

      <div className="bg-dk-navy text-white px-3 py-1.5 text-sm font-bold tracking-tight">
        {table.name || '(이름 없음)'}
      </div>
      <div className="divide-y divide-gray-50">
        {table.columns.length === 0 && (
          <div className="px-3 py-2 text-xs text-gray-300">컬럼 없음</div>
        )}
        {table.columns.map((c) => (
          <div key={c.id} className="flex items-center gap-2 px-3 py-1 text-xs">
            <span className={`w-3 text-center ${c.pk ? 'text-dk-orange' : 'text-transparent'}`} title={c.pk ? 'Primary Key' : ''}>
              🔑
            </span>
            <span className={`flex-1 ${c.pk ? 'font-bold text-gray-700' : 'text-gray-600'}`}>
              {c.name || '?'}
            </span>
            <span className="text-gray-400 font-mono">
              {physicalTypeName(c.type, dialect)}{c.length ? `(${c.length})` : ''}{c.unique && !c.pk ? ' U' : ''}{c.notNull || c.pk ? ' *' : ''}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
