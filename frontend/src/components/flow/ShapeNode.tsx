import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Handle, Position, useReactFlow, type NodeProps, type Node } from '@xyflow/react';

export type ShapeKind =
  | 'terminator' | 'process' | 'decision' | 'io'
  | 'document' | 'database' | 'hexagon' | 'connector' | 'subroutine';

export interface ShapeData {
  label: string;
  shape: ShapeKind;
  color: string;
  [key: string]: unknown;
}

export type ShapeNodeT = Node<ShapeData>;

const DEFAULT_LABEL: Record<ShapeKind, string> = {
  terminator: '시작/종료', process: '처리', decision: '조건?', io: '입출력',
  document: '문서', database: 'DB', hexagon: '준비', connector: '연결', subroutine: '정의된 처리',
};

// ERD와 동일한 핸들 스타일: 작은 고정 점(전역 .react-flow__handle = w-2 h-2 border-white), hover 확대/이동 없음
const HANDLE = '!bg-dk-blue';

export default function ShapeNode({ id, data, selected }: NodeProps) {
  const d = data as ShapeData;
  const { updateNodeData } = useReactFlow();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(d.label);
  const taRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing) {
      setDraft(d.label);
      setTimeout(() => { taRef.current?.focus(); taRef.current?.select(); }, 0);
    }
  }, [editing, d.label]);

  const commit = () => { updateNodeData(id, { label: draft }); setEditing(false); };
  const cancel = () => setEditing(false);

  // 선택 표시는 얇게(테두리가 점을 가리지 않도록 offset 제거)
  const ring = selected ? 'ring-2 ring-dk-blue' : '';
  const base = 'flex items-center justify-center text-center text-[13px] text-white px-3 py-2 min-w-[110px] min-h-[44px] shadow-sm';
  const color = d.color || '#1A67A3';
  const text = d.label || DEFAULT_LABEL[d.shape] || '';

  const editor = (
    <textarea
      ref={taRef}
      className="nodrag nowheel absolute inset-0 w-full h-full resize-none bg-white/95 text-gray-800 text-[12px] text-center rounded px-1 py-1 outline-none ring-2 ring-dk-blue z-10"
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        e.stopPropagation();
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); commit(); }
        if (e.key === 'Escape') { e.preventDefault(); cancel(); }
      }}
    />
  );

  // 고정 크기 도형(SVG 배경 + 가운데 텍스트)
  const Fixed = ({ w, h, bg }: { w: number; h: number; bg: ReactNode }) => (
    <div className={`relative ${ring}`} style={{ width: w, height: h }} onDoubleClick={() => setEditing(true)}>
      {bg}
      <div className="absolute inset-0 flex items-center justify-center text-[12px] text-white px-3 text-center leading-tight">{text}</div>
      {editing && editor}
    </div>
  );

  let shapeEl: ReactNode;
  switch (d.shape) {
    case 'decision':
      shapeEl = (
        <div className={`relative ${ring}`} style={{ width: 120, height: 120 }} onDoubleClick={() => setEditing(true)}>
          <div className="absolute inset-0 m-auto" style={{ width: 86, height: 86, transform: 'rotate(45deg)', background: color }} />
          <div className="absolute inset-0 flex items-center justify-center text-[12px] text-white px-2 text-center leading-tight">{text}</div>
          {editing && <div className="absolute inset-0 m-auto" style={{ width: 86, height: 86 }}>{editor}</div>}
        </div>
      );
      break;
    case 'terminator':
      shapeEl = (
        <div className={`${base} rounded-full ${ring} relative`} style={{ background: color }} onDoubleClick={() => setEditing(true)}>
          {text}{editing && editor}
        </div>
      );
      break;
    case 'io':
      shapeEl = (
        <div className={`${base} ${ring} relative`} style={{ background: color, transform: 'skewX(-18deg)' }} onDoubleClick={() => setEditing(true)}>
          <span style={{ transform: 'skewX(18deg)' }}>{text}</span>
          {editing && <span style={{ transform: 'skewX(18deg)' }} className="absolute inset-0">{editor}</span>}
        </div>
      );
      break;
    case 'subroutine':
      shapeEl = (
        <div className={`${base} rounded-md ${ring} relative`} style={{ background: color }} onDoubleClick={() => setEditing(true)}>
          <span className="absolute left-1.5 top-0 bottom-0 w-px bg-white/50" />
          <span className="absolute right-1.5 top-0 bottom-0 w-px bg-white/50" />
          {text}{editing && editor}
        </div>
      );
      break;
    case 'connector':
      shapeEl = (
        <div className={`relative ${ring} rounded-full flex items-center justify-center text-white text-[11px] text-center shadow-sm`}
          style={{ width: 56, height: 56, background: color }} onDoubleClick={() => setEditing(true)}>
          {text}{editing && editor}
        </div>
      );
      break;
    case 'document':
      shapeEl = (
        <Fixed w={140} h={76} bg={
          <svg viewBox="0 0 140 76" width={140} height={76} preserveAspectRatio="none" className="absolute inset-0">
            <path d="M3 4 H137 V58 C114 76 86 52 60 62 C40 70 20 58 3 64 Z" fill={color} />
          </svg>
        } />
      );
      break;
    case 'database':
      shapeEl = (
        <Fixed w={120} h={84} bg={
          <svg viewBox="0 0 120 84" width={120} height={84} preserveAspectRatio="none" className="absolute inset-0">
            <path d="M6 14 V70 A54 11 0 0 0 114 70 V14 Z" fill={color} />
            <ellipse cx="60" cy="14" rx="54" ry="11" fill={color} stroke="rgba(255,255,255,.45)" />
            <path d="M6 14 A54 11 0 0 0 114 14" fill="none" stroke="rgba(255,255,255,.45)" />
          </svg>
        } />
      );
      break;
    case 'hexagon':
      shapeEl = (
        <Fixed w={140} h={70} bg={
          <svg viewBox="0 0 140 70" width={140} height={70} preserveAspectRatio="none" className="absolute inset-0">
            <polygon points="28,4 112,4 136,35 112,66 28,66 4,35" fill={color} />
          </svg>
        } />
      );
      break;
    case 'process':
    default:
      shapeEl = (
        <div className={`${base} rounded-md ${ring} relative`} style={{ background: color }} onDoubleClick={() => setEditing(true)}>
          {text}{editing && editor}
        </div>
      );
  }

  return (
    <div className="relative">
      <Handle id="t" type="source" position={Position.Top} className={HANDLE} />
      <Handle id="l" type="source" position={Position.Left} className={HANDLE} />
      <Handle id="r" type="source" position={Position.Right} className={HANDLE} />
      <Handle id="b" type="source" position={Position.Bottom} className={HANDLE} />
      {shapeEl}
    </div>
  );
}
