import { forwardRef, useRef, useMemo } from 'react';

// VS Code 스타일 줄번호 거터 + textarea (공용).
// whitespace:pre(줄바꿈 없음)이므로 논리 줄 1개 = 시각 행 1개 → 줄번호가 각 행과 1:1 정렬된다.
// 거터는 textarea 세로 스크롤에 동기화된다.
// ★ 대용량 대응: 줄번호를 줄마다 <div>로 렌더하면 수만 줄에서 DOM 노드가 폭증해 브라우저가
//   강제 종료된다. 줄번호를 단일 텍스트 노드(숫자를 \n으로 이어 붙인 문자열)로 렌더한다.
interface CodeAreaProps {
  value: string;
  onChange?: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  className?: string;      // 루트 크기 지정(기본 flex-1 min-h-0). 고정 높이는 h-full 등을 전달
  dark?: boolean;          // 강제 다크 페인(예: 결과창). 미지정 시 테마 연동
}

const CodeArea = forwardRef<HTMLTextAreaElement, CodeAreaProps>(function CodeArea(
  { value, onChange, onKeyDown, placeholder, className, dark },
  ref,
) {
  const gutterRef = useRef<HTMLDivElement>(null);
  // 대용량 value(수백 KB)를 매 렌더마다 split 하지 않도록 메모이즈
  const count = useMemo(() => (value ? value.split('\n').length : 1), [value]);
  // 줄번호 문자열은 줄 수가 바뀔 때만 재생성 (수만 줄이어도 노드 1개)
  const gutterText = useMemo(() => {
    const arr = new Array(count);
    for (let i = 0; i < count; i++) arr[i] = i + 1;
    return arr.join('\n');
  }, [count]);
  const onScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
  };
  return (
    <div
      className={`flex overflow-hidden rounded-md border ${
        dark ? 'border-[#243149] bg-[#0f172a]' : 'border-gray-200 dark:border-[#2A3953] bg-white dark:bg-[#162033]'
      } ${className ?? 'flex-1 min-h-0'}`}
    >
      <div
        ref={gutterRef}
        aria-hidden
        className={`shrink-0 overflow-hidden text-right select-none font-mono text-[13px] leading-relaxed whitespace-pre py-2 pl-2.5 pr-2 border-r ${
          dark ? 'text-[#475569] border-[#1e293b]' : 'text-gray-300 border-gray-100 dark:text-[#3b4a63] dark:border-[#243149]'
        }`}
        style={{ minWidth: `${String(count).length + 2}ch` }}
      >
        {gutterText}
      </div>
      <textarea
        ref={ref}
        value={value}
        onChange={onChange ? (e) => onChange(e.target.value) : undefined}
        onKeyDown={onKeyDown}
        onScroll={onScroll}
        readOnly={!onChange}
        spellCheck={false}
        placeholder={placeholder}
        className={`flex-1 min-w-0 w-full resize-none border-none outline-none py-2 pl-3 pr-3 font-mono text-[13px] leading-relaxed whitespace-pre overflow-auto bg-transparent ${
          dark ? 'text-[#e2e8f0]' : 'text-gray-800 dark:text-gray-100'
        }`}
        style={{ tabSize: 4 }}
      />
    </div>
  );
});

export default CodeArea;
