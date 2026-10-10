import { useRef, useState, useCallback, useEffect, forwardRef } from 'react';
import toast from 'react-hot-toast';
import Layout from '../components/Layout';
import { formatSQL, SAMPLE_SQL, checkSqlParens } from '../lib/sqlFormatter';

const countLines = (s: string) => (s ? s.split('\n').length : 0);

// VS Code 스타일 줄번호 거터 + textarea. 거터는 textarea 세로 스크롤에 동기화된다.
// whitespace:pre(줄바꿈 없음)이므로 논리 줄 1개 = 시각 행 1개 → 줄번호가 각 행과 1:1 정렬된다.
interface CodeAreaProps {
  value: string;
  onChange?: (v: string) => void;
  onKeyDown?: (e: React.KeyboardEvent) => void;
  placeholder?: string;
  dark?: boolean;
}
const CodeArea = forwardRef<HTMLTextAreaElement, CodeAreaProps>(function CodeArea(
  { value, onChange, onKeyDown, placeholder, dark },
  ref,
) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const count = value ? value.split('\n').length : 1;
  const nums: number[] = [];
  for (let i = 1; i <= count; i++) nums.push(i);
  const onScroll = (e: React.UIEvent<HTMLTextAreaElement>) => {
    if (gutterRef.current) gutterRef.current.scrollTop = e.currentTarget.scrollTop;
  };
  return (
    <div className="flex-1 min-h-0 flex overflow-hidden">
      <div
        ref={gutterRef}
        aria-hidden
        className={`shrink-0 overflow-hidden text-right select-none font-mono text-[13px] leading-relaxed py-3.5 pl-2.5 pr-2 border-r ${
          dark ? 'bg-[#0b1220] text-[#475569] border-[#1e293b]' : 'bg-gray-50/70 text-gray-300 border-gray-100'
        }`}
        style={{ minWidth: `${String(count).length + 2}ch` }}
      >
        {nums.map((n) => (
          <div key={n}>{n}</div>
        ))}
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
        className={`flex-1 min-h-0 w-full resize-none border-none outline-none py-3.5 pl-3 pr-3.5 font-mono text-[13px] leading-relaxed whitespace-pre overflow-auto ${
          dark ? 'bg-[#0f172a] text-[#e2e8f0]' : 'text-gray-800'
        }`}
        style={{ tabSize: 4 }}
      />
    </div>
  );
});

const AUTO_COPY_KEY = 'devkit_sql_autocopy';
// 이 길이를 넘으면 자동 정렬을 끄고 수동 실행을 유도 (대용량 붙여넣기 시 브라우저 멈춤 방지)
const AUTO_FORMAT_MAX = 100_000;

export default function SqlFormatPage() {
  const [input, setInput] = useState('');
  const [output, setOutput] = useState('');
  const [autoCopy, setAutoCopy] = useState(() => localStorage.getItem(AUTO_COPY_KEY) === '1');
  const [status, setStatus] = useState<{ text: string; kind?: 'ok' | 'err' }>({
    text: 'SQL을 붙여넣으면 자동으로 정렬됩니다. (Ctrl+Enter = 수동 실행)',
  });
  const outRef = useRef<HTMLTextAreaElement>(null);

  const copyToClipboard = useCallback(async (text: string): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      try {
        outRef.current?.select();
        return document.execCommand('copy');
      } catch {
        return false;
      }
    }
  }, []);

  const toggleAutoCopy = (on: boolean) => {
    setAutoCopy(on);
    localStorage.setItem(AUTO_COPY_KEY, on ? '1' : '0');
  };

  // auto=true: 입력 변경(붙여넣기/타이핑) 시 자동 정렬. 미완성 입력(괄호 불균형)은 조용히 대기, 자동복사 안 함.
  const doFormat = useCallback((auto: boolean) => {
    if (!input.trim()) {
      setOutput('');
      setStatus(auto
        ? { text: 'SQL을 붙여넣으면 자동으로 정렬됩니다. (Ctrl+Enter = 수동 실행)' }
        : { text: '정렬할 SQL이 없습니다.', kind: 'err' });
      return;
    }
    // 괄호 불균형 사전 검사 — 정렬이 무너지는 대표 원인
    const paren = checkSqlParens(input);
    if (!paren.balanced) {
      if (auto) return;  // 타이핑 중엔 이전 결과를 유지한 채 조용히 대기
      const parts: string[] = [];
      if (paren.open > 0) parts.push(`닫는 ')' ${paren.open}개 부족 (열린 '(' 위치 line ${paren.openLines.slice(0, 5).join(', ')}${paren.openLines.length > 5 ? ' …' : ''})`);
      if (paren.close > 0) parts.push(`여는 '(' ${paren.close}개 부족 (남는 ')' line ${paren.strayCloseLines.slice(0, 5).join(', ')}${paren.strayCloseLines.length > 5 ? ' …' : ''})`);
      setOutput('');
      setStatus({ text: `⚠ 괄호가 맞지 않아 정렬할 수 없습니다 — ${parts.join(' · ')}`, kind: 'err' });
      return;
    }
    const t0 = performance.now();
    const result = formatSQL(input);
    const ms = Math.max(1, Math.round(performance.now() - t0));
    setOutput(result);
    const base = auto ? `자동 정렬됨 · ${countLines(result)}줄 · ${ms}ms` : `정렬 완료 · ${countLines(result)}줄 · ${ms}ms`;
    if (autoCopy) {
      copyToClipboard(result).then((ok) =>
        setStatus({ text: ok ? `${base} · 클립보드에 자동 복사됨` : `${base} (자동 복사 실패)`, kind: 'ok' }),
      );
    } else {
      setStatus({ text: base, kind: 'ok' });
    }
  }, [input, autoCopy, copyToClipboard]);

  const runFormat = useCallback(() => doFormat(false), [doFormat]);

  // 입력 변경(붙여넣기 포함) 시 디바운스 자동 정렬 → 우측 결과 즉시 갱신.
  // 대용량 입력은 붙여넣는 순간 정렬+렌더가 몰려 저사양 PC에서 브라우저가 멈출 수 있으므로
  // 자동 정렬을 끄고 수동 실행을 유도한다.
  useEffect(() => {
    if (!input.trim()) return;
    if (input.length > AUTO_FORMAT_MAX) {
      setStatus({ text: `대용량 SQL(${(input.length / 1024).toFixed(0)}KB) — 자동 정렬을 껐습니다. [정렬 실행] 또는 Ctrl+Enter로 정렬하세요.` });
      return;
    }
    const id = setTimeout(() => doFormat(true), 300);
    return () => clearTimeout(id);
  }, [input, doFormat]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      runFormat();
    }
  };

  const copyOutput = async () => {
    if (!output) {
      toast.error('복사할 결과가 없습니다.');
      return;
    }
    if (await copyToClipboard(output)) toast.success('결과를 클립보드에 복사했습니다.');
    else toast.error('복사에 실패했습니다.');
  };

  const actions = (
    <>
      <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-300 select-none cursor-pointer whitespace-nowrap" title="정렬 실행 시 결과를 클립보드에 자동 복사">
        <input type="checkbox" className="accent-dk-blue" checked={autoCopy} onChange={(e) => toggleAutoCopy(e.target.checked)} />
        정렬 후 자동 복사
      </label>
      <button className="dk-btn-ghost" onClick={() => { setInput(SAMPLE_SQL); setStatus({ text: '예시 SQL을 불러왔습니다.' }); }}>
        예시 SQL
      </button>
      <button className="dk-btn-ghost" onClick={() => { setInput(''); setOutput(''); setStatus({ text: '초기화했습니다.' }); }}>
        전체 지우기
      </button>
      <button className="dk-btn-secondary" onClick={copyOutput}>결과 복사</button>
      <button className="dk-btn-primary" onClick={runFormat}>
        정렬 실행 <span className="ml-1 text-[11px] px-1.5 py-0.5 rounded bg-white/20">Ctrl+Enter</span>
      </button>
    </>
  );

  return (
    <Layout title="SQL 정렬" subtitle="SELECT · INSERT · UPDATE · DELETE · MERGE — i-AUD 바인딩 변수 보존" actions={actions}>
      <div className="flex flex-col h-full gap-3">
        <div className="grid grid-cols-2 gap-3 flex-1 min-h-0">
          <div className="dk-card flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-600">
              <span>원본 SQL</span>
              <span className="font-normal text-gray-400">{countLines(input)}줄</span>
            </div>
            <CodeArea
              value={input}
              onChange={setInput}
              onKeyDown={onKeyDown}
              placeholder={'여기에 SQL을 붙여넣고 [정렬 실행] 버튼을 누르세요.\n\n예) SELECT * FROM TABLE WHERE COL = :VS_VAL'}
            />
          </div>
          <div className="dk-card flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100 text-xs font-semibold text-gray-600">
              <span>정렬 결과</span>
              <span className="font-normal text-gray-400">{countLines(output)}줄</span>
            </div>
            <CodeArea
              ref={outRef}
              value={output}
              dark
              placeholder="정렬된 SQL이 여기에 표시됩니다."
            />
          </div>
        </div>
        <div className={`text-xs px-1 ${status.kind === 'ok' ? 'text-dk-green' : status.kind === 'err' ? 'text-dk-red' : 'text-gray-400'}`}>
          {status.text}
        </div>
      </div>
    </Layout>
  );
}
