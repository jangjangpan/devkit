import { useEffect, useMemo, useRef, useState } from 'react';

export interface SSOption {
  value: string;
  label: string;
}

interface Props {
  options: SSOption[];
  /** 현재 선택 값(테이블 선택처럼 유지형). 미지정/추가형은 빈 문자열. */
  value?: string;
  placeholder?: string;
  onSelect: (value: string) => void;
  /** true면 선택 후 입력 초기화(컬럼 추가처럼 반복 선택용) */
  resetOnSelect?: boolean;
  className?: string;
}

// 검색형 드롭다운(콤보박스). 항목이 많을 때 입력으로 필터링해 선택.
export default function SearchSelect({ options, value, placeholder, onSelect, resetOnSelect, className }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  const selectedLabel = useMemo(
    () => options.find((o) => o.value === value)?.label || '',
    [options, value],
  );

  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const filtered = useMemo(() => {
    const k = query.trim().toLowerCase();
    if (!k) return options;
    return options.filter((o) => o.label.toLowerCase().includes(k) || o.value.toLowerCase().includes(k));
  }, [options, query]);

  const pick = (o: SSOption) => {
    onSelect(o.value);
    setOpen(false);
    setQuery(resetOnSelect ? '' : o.label);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!open && (e.key === 'ArrowDown' || e.key === 'Enter')) { setOpen(true); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); if (filtered[active]) pick(filtered[active]); }
    else if (e.key === 'Escape') { setOpen(false); }
  };

  return (
    <div className={`relative ${className || ''}`} ref={ref}>
      <input
        className="dk-input w-full !py-1 text-xs"
        placeholder={placeholder}
        value={open ? query : (resetOnSelect ? query : selectedLabel)}
        onChange={(e) => { setQuery(e.target.value); setOpen(true); setActive(0); }}
        onFocus={() => { setOpen(true); setQuery(''); setActive(0); }}
        onKeyDown={onKey}
      />
      {open && (
        <div className="absolute left-0 right-0 mt-1 z-50 max-h-60 overflow-auto bg-white dark:bg-[#162033] border border-gray-100 dark:border-[#243149] rounded-lg shadow-xl">
          {filtered.length === 0 && <div className="px-3 py-2 text-xs text-gray-400">일치하는 항목이 없습니다.</div>}
          {filtered.map((o, i) => (
            <div key={o.value}
              onMouseDown={(e) => { e.preventDefault(); pick(o); }}
              onMouseEnter={() => setActive(i)}
              className={`px-3 py-1.5 text-xs cursor-pointer truncate ${
                i === active ? 'bg-dk-blue/10 text-dk-blue' : 'text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-white/5'
              } ${o.value === value ? 'font-bold' : ''}`}>
              {o.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
